package com.trythis.app;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Share → Wanna Try (MOBILE_ARCHITECTURE.md, P0 #1).
 *
 * Receives Android ACTION_SEND / ACTION_SEND_MULTIPLE intents (text, URLs,
 * images) and hands them to the web layer as { text, subject, images:[{mimeType,
 * base64}] }. Two paths: the app was launched by the share (checkIntent on
 * boot) or it was already running (onNewIntent → "shareReceived" event).
 * Images are read through the ContentResolver and passed as base64 so the web
 * layer can upload them with the existing screenshot flow; capped to keep the
 * bridge message small.
 */
@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {
    private static final int MAX_IMAGES = 8;
    private static final int MAX_BYTES_PER_IMAGE = 6 * 1024 * 1024;
    private JSObject pending = null;

    @Override
    public void load() {
        Intent intent = getActivity().getIntent();
        pending = fromIntent(intent);
        if (pending != null) getActivity().setIntent(new Intent()); // consume, so a resume doesn't re-share
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        JSObject data = fromIntent(intent);
        if (data != null) {
            pending = data;
            notifyListeners("shareReceived", data, true);
        }
    }

    /** Returns the share that launched or resumed the app, once; null otherwise. */
    @PluginMethod
    public void checkIntent(PluginCall call) {
        JSObject out = pending != null ? pending : new JSObject();
        pending = null;
        call.resolve(out);
    }

    private JSObject fromIntent(Intent intent) {
        if (intent == null) return null;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return null;
        JSObject out = new JSObject();
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (text != null) out.put("text", text);
        if (subject != null) out.put("subject", subject);
        out.put("type", intent.getType() != null ? intent.getType() : "");

        List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) uris.add(u);
        } else {
            ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) uris.addAll(list);
        }
        if (uris.isEmpty() && intent.getClipData() != null) {
            ClipData clip = intent.getClipData();
            for (int i = 0; i < clip.getItemCount(); i++) { Uri u = clip.getItemAt(i).getUri(); if (u != null) uris.add(u); }
        }

        JSArray images = new JSArray();
        int n = 0;
        for (Uri u : uris) {
            if (n >= MAX_IMAGES) break;
            try {
                String mime = getContext().getContentResolver().getType(u);
                if (mime == null || !mime.startsWith("image/")) continue;
                InputStream in = getContext().getContentResolver().openInputStream(u);
                if (in == null) continue;
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] chunk = new byte[64 * 1024];
                int read; int total = 0;
                while ((read = in.read(chunk)) != -1) { total += read; if (total > MAX_BYTES_PER_IMAGE) break; buf.write(chunk, 0, read); }
                in.close();
                if (total > MAX_BYTES_PER_IMAGE) continue;
                JSObject img = new JSObject();
                img.put("mimeType", mime);
                img.put("base64", Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP));
                images.put(img);
                n++;
            } catch (Exception ignored) { /* skip unreadable items; the rest still arrive */ }
        }
        out.put("images", images);
        if (text == null && subject == null && images.length() == 0) return null;
        return out;
    }
}

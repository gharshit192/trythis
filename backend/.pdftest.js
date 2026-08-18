const PDFDocument = require('pdfkit');
const fs = require('fs');
const DEVA = '/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf';
const HINDI = 'लेकिन फंड का सदुपयोग करती हो । पर्यावरण संरक्षक कोई भैना देना नहीं है। एक संस्था से मैंने तुम्हें सरंक्षण के लिए सम्मानित किया।';
const doc = new PDFDocument({ margin: 40, size: 'A4' });
doc.pipe(fs.createWriteStream(process.argv[2]));

doc.fontSize(16).font('Helvetica-Bold').fillColor('#c0392b').text('1. Helvetica (what ships today)');
doc.moveDown(0.3);
doc.fontSize(13).font('Helvetica').fillColor('#000').text(HINDI, { lineGap: 3 });
doc.moveDown(1.5);

doc.fontSize(16).font('Helvetica-Bold').fillColor('#1f6b4a').text('2. Embedded Noto Sans Devanagari');
doc.moveDown(0.3);
doc.registerFont('deva', DEVA);
doc.fontSize(13).font('deva').fillColor('#000').text(HINDI, { lineGap: 6 });
doc.moveDown(1.5);

doc.fontSize(16).font('Helvetica-Bold').fillColor('#1f6b4a').text('3. Conjuncts + matras (hard cases)');
doc.moveDown(0.3);
doc.fontSize(15).font('deva').fillColor('#000').text('क्ष त्र ज्ञ श्री द्ध  |  कि की कु कू के कै को कौ  |  हिन्दी १००८', { lineGap: 6 });
doc.end();

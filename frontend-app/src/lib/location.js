// Automatic refreshes must never turn an expired grant into a new prompt.
export async function getLocation(onSuccess, onError = () => {}, options = {}) {
  const { requestPermission = false, ...positionOptions } = options;
  if (!navigator.geolocation) { onError({ code: 2 }); return; }
  if (!requestPermission) {
    try {
      if (localStorage.getItem('location_requested') === 'denied') { onError({ code: 1 }); return; }
      const permission = await navigator.permissions?.query({ name: 'geolocation' });
      if (permission?.state !== 'granted') { onError({ code: 1 }); return; }
    } catch { onError({ code: 2 }); return; }
  }
  navigator.geolocation.getCurrentPosition(onSuccess, onError, {
    timeout: 10000, maximumAge: 300000, ...positionOptions,
  });
}

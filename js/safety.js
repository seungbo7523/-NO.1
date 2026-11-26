(() => {
  function updateTerrainProfile(course) {
    const profile = course?.profileElevationEstimateM;
    const distanceKm = Number.parseFloat(course?.distance);
    const isValidProfile = Array.isArray(profile)
      && profile.length >= 2
      && profile.every(Number.isFinite)
      && Number.isFinite(distanceKm)
      && distanceKm > 0;

    if (!isValidProfile) {
      document.getElementById('terrain-profile-title').textContent = '지형 단면 자료 없음';
      document.getElementById('terrain-profile-distance').textContent = '';
      document.getElementById('terrain-profile-end').textContent = '';
      document.getElementById('terrain-profile-line').setAttribute('d', '');
      document.getElementById('terrain-profile-area').setAttribute('d', '');
      document.getElementById('terrain-profile-facility-marker').setAttribute('visibility', 'hidden');
      document.getElementById('terrain-profile-accident-marker').setAttribute('visibility', 'hidden');
      document.getElementById('terrain-profile-note').textContent = '코스별 고도 자료를 확인할 수 없습니다.';
      return;
    }

    const minElevation = Math.min(...profile);
    const maxElevation = Math.max(...profile);
    const elevationRange = Math.max(maxElevation - minElevation, 1);
    const plot = { left: 36, right: 304, top: 24, bottom: 100 };
    const points = profile.map((elevation, index) => {
      const x = plot.left + (index / (profile.length - 1)) * (plot.right - plot.left);
      const y = plot.bottom - ((elevation - minElevation) / elevationRange) * (plot.bottom - plot.top);
      return { x, y, elevation };
    });
    const linePath = points.map((point, index) =>
      `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`
    ).join(' ');
    const areaPath = `${linePath} L${plot.right},${plot.bottom} L${plot.left},${plot.bottom} Z`;
    const peak = points.reduce((highest, point) => point.elevation > highest.elevation ? point : highest, points[0]);

    const updateSafetyMarker = (type, fraction) => {
      const samplePosition = fraction * (points.length - 1);
      const startIndex = Math.floor(samplePosition);
      const endIndex = Math.min(startIndex + 1, points.length - 1);
      const ratio = samplePosition - startIndex;
      const x = points[startIndex].x + (points[endIndex].x - points[startIndex].x) * ratio;
      const y = points[startIndex].y + (points[endIndex].y - points[startIndex].y) * ratio;
      const marker = document.getElementById(`terrain-profile-${type}-marker`);
      const line = document.getElementById(`terrain-profile-${type}-marker-line`);
      const circle = document.getElementById(`terrain-profile-${type}-marker-circle`);
      const glyph = document.getElementById(`terrain-profile-${type}-marker-glyph`);

      marker.setAttribute('visibility', 'visible');
      line.setAttribute('x1', x.toFixed(1));
      line.setAttribute('y1', y.toFixed(1));
      line.setAttribute('x2', x.toFixed(1));
      line.setAttribute('y2', plot.bottom.toFixed(1));
      circle.setAttribute('cx', x.toFixed(1));
      circle.setAttribute('cy', y.toFixed(1));
      glyph.setAttribute('x', x.toFixed(1));
      glyph.setAttribute('y', (y + 2.2).toFixed(1));
    };

    document.getElementById('terrain-profile-title').textContent = `${course.title} 지형 단면`;
    document.getElementById('terrain-profile-distance').textContent = `총 거리 ${course.distance} · 표시 최고 고도 약 ${maxElevation.toLocaleString('ko-KR')}m`;
    document.getElementById('terrain-profile-end').textContent = `종점 · ${distanceKm} km`;
    document.getElementById('terrain-profile-max').textContent = `${maxElevation}m`;
    document.getElementById('terrain-profile-min').textContent = `${minElevation}m`;
    document.getElementById('terrain-profile-line').setAttribute('d', linePath);
    document.getElementById('terrain-profile-area').setAttribute('d', areaPath);
    document.getElementById('terrain-profile-peak').setAttribute('cx', peak.x.toFixed(1));
    document.getElementById('terrain-profile-peak').setAttribute('cy', peak.y.toFixed(1));
    document.getElementById('terrain-profile-peak-label').setAttribute('x', peak.x.toFixed(1));
    document.getElementById('terrain-profile-peak-label').setAttribute('y', Math.max(12, peak.y - 8).toFixed(1));
    document.getElementById('terrain-profile-peak-label').textContent = `약 ${maxElevation}m`;
    updateSafetyMarker('facility', 0.36);
    updateSafetyMarker('accident', 0.72);
  }

  function updateAltitude(value) {
    const altitude = Number(value);
    const readout = document.getElementById('altitude-readout');
    const banner = document.getElementById('altitude-warning-banner');
    const signalText = document.getElementById('status-signal-text');
    if (!Number.isFinite(altitude)) {
      readout.textContent = '고도 데이터 없음';
      banner.classList.add('hidden');
      signalText.textContent = '시연 데이터';
      return;
    }

    readout.textContent = `해발 ${altitude.toLocaleString()}m`;
    if (altitude >= 650) {
      banner.classList.remove('hidden');
      readout.className = 'text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800';
      signalText.textContent = '시연: 기준 초과';
      signalText.className = 'text-[10px] text-amber-300 font-semibold';
    } else {
      banner.classList.add('hidden');
      readout.className = 'text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-forest-100 text-forest-800';
      signalText.textContent = '시연: 기준 미만';
      signalText.className = 'text-[10px] text-emerald-300 font-semibold';
    }
  }

  window.TrailMateSafety = Object.freeze({ updateTerrainProfile, updateAltitude });
})();

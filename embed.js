/* Embed for "How the Library Works" — https://lbcsystems.labs.trlibrary.com
   <div id="trpl-lbcsystems"></div>
   <script src="https://lbcsystems.labs.trlibrary.com/embed.js" defer></script>
   Options (data- attributes on the script tag):
     data-target="#id"     element to fill (default #trpl-lbcsystems)
     data-layer="water"    overview | energy | water | carbon
     data-stop="2"         open a numbered stop in that layer
     data-lock="on"        hide the layer tabs (single-system embed)
     data-panel="off"      model only, no text panel
     data-height="640"     height in pixels (default: 16:10, 520–760px)          */
(function () {
  var scripts = document.querySelectorAll('script[src*="embed.js"]:not([data-done])');
  Array.prototype.forEach.call(scripts, function (s) {
    s.setAttribute('data-done', '1');
    var BASE = new URL('./', s.src).href;
    var d = s.dataset, target = document.querySelector(d.target || '#trpl-lbcsystems');
    if (!target) return;
    var q = ['embed=1'];
    if (d.layer) q.push('layer=' + encodeURIComponent(d.layer));
    if (d.stop) q.push('stop=' + encodeURIComponent(d.stop));
    if (d.lock === 'on') q.push('lock=1');
    if (d.panel === 'off') q.push('panel=0');
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:100%;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 20px rgba(22,55,40,.08);background:#EEF0EA';
    var f = document.createElement('iframe');
    f.setAttribute('allowfullscreen', '');
    f.src = BASE + '?' + q.join('&');
    f.title = 'How the Library Works: interactive 3D model of the Library’s ' + (d.layer && d.layer !== 'overview' ? d.layer + ' system' : 'energy, water and carbon systems');
    f.loading = 'lazy';
    f.allow = 'fullscreen';
    f.style.cssText = 'display:block;width:100%;border:0';
    var size = function () {
      var w = wrap.clientWidth || target.clientWidth || 800;
      var h = d.height ? +d.height : Math.max(520, Math.min(760, Math.round(w * 0.625)));
      if (w < 700 && !d.height) h = Math.round(Math.min(window.innerHeight * 0.85, 760));
      f.style.height = h + 'px';
    };
    wrap.appendChild(f); target.appendChild(wrap);
    size(); window.addEventListener('resize', size);
  });
})();

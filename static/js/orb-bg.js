(function () {
  "use strict";

  function initOrbBackground(container) {
    requestAnimationFrame(function () {
      container.classList.add("orbs-mounted");
    });

    var isFixed = container.classList.contains("orb-bg");
    var rect = container.getBoundingClientRect();

    // --- Floating glow particles ---
    for (var i = 0; i < 26; i++) {
      var p = document.createElement("div");
      p.className = "orb-particle";
      var size = 1.5 + Math.random() * 4;
      p.style.cssText =
        "left:" + (Math.random() * 100) + "%;" +
        "top:" + (Math.random() * 100) + "%;" +
        "width:" + size + "px;" +
        "height:" + size + "px;" +
        "animation-delay:" + (-Math.random() * 14) + "s;" +
        "animation-duration:" + (9 + Math.random() * 13) + "s;";
      container.appendChild(p);
    }

    // --- Static star field ---
    for (var j = 0; j < 45; j++) {
      var s = document.createElement("div");
      s.className = "orb-star";
      var ss = 0.5 + Math.random() * 1.8;
      s.style.cssText =
        "left:" + (Math.random() * 100) + "%;" +
        "top:" + (Math.random() * 100) + "%;" +
        "width:" + ss + "px;" +
        "height:" + ss + "px;" +
        "opacity:" + (0.15 + Math.random() * 0.55) + ";" +
        "animation-delay:" + (Math.random() * 5) + "s;";
      container.appendChild(s);
    }

    // --- Micro-orbs for extra clutter ---
    var microPositions = [
      { top: "20%", left: "30%", size: 180 },
      { top: "65%", left: "75%", size: 140 },
      { top: "45%", left: "10%", size: 120 },
    ];
    microPositions.forEach(function (pos, idx) {
      var m = document.createElement("div");
      m.className = "orb orb-micro";
      m.style.cssText =
        "top:" + pos.top + ";left:" + pos.left + ";" +
        "width:" + pos.size + "px;height:" + pos.size + "px;" +
        "transition-delay:" + (0.4 + idx * 0.2) + "s;";
      var inner = document.createElement("div");
      inner.className = "orb-inner orb-micro-inner";
      m.appendChild(inner);
      container.appendChild(m);
    });

    // --- Cursor glow follower ---
    var glow = document.createElement("div");
    glow.className = "orb-cursor-glow";
    container.appendChild(glow);

    // --- Mouse parallax on orb-inner elements ---
    var orbInners = container.querySelectorAll(".orb:not(.orb-micro) .orb-inner");
    var depths = [0.02, -0.014, 0.026, -0.018];
    var cx = [], cy = [], tx = [], ty = [];
    for (var k = 0; k < orbInners.length; k++) { cx[k] = cy[k] = tx[k] = ty[k] = 0; }

    var glowX = 0, glowY = 0, glowTX = 0, glowTY = 0;

    function onMouseMove(e) {
      var mx = (e.clientX / window.innerWidth) - 0.5;
      var my = (e.clientY / window.innerHeight) - 0.5;
      for (var n = 0; n < orbInners.length; n++) {
        tx[n] = mx * window.innerWidth * depths[n];
        ty[n] = my * window.innerHeight * depths[n];
      }
      if (isFixed) {
        glowTX = e.clientX;
        glowTY = e.clientY;
      } else {
        rect = container.getBoundingClientRect();
        glowTX = e.clientX - rect.left;
        glowTY = e.clientY - rect.top;
      }
    }
    document.addEventListener("mousemove", onMouseMove);

    // --- Click ripple ---
    container.addEventListener("click", function (e) {
      var r = document.createElement("div");
      r.className = "orb-ripple";
      var bnd = container.getBoundingClientRect();
      r.style.left = (e.clientX - bnd.left) + "px";
      r.style.top  = (e.clientY - bnd.top)  + "px";
      container.appendChild(r);
      r.addEventListener("animationend", function () { r.remove(); });
    });

    // --- Raf loop ---
    function tick() {
      for (var n = 0; n < orbInners.length; n++) {
        cx[n] += (tx[n] - cx[n]) * 0.045;
        cy[n] += (ty[n] - cy[n]) * 0.045;
        orbInners[n].style.transform =
          "translate(" + cx[n].toFixed(2) + "px," + cy[n].toFixed(2) + "px)";
      }
      glowX += (glowTX - glowX) * 0.09;
      glowY += (glowTY - glowY) * 0.09;
      glow.style.transform =
        "translate(" + (glowX - 150).toFixed(1) + "px," + (glowY - 150).toFixed(1) + "px)";
      requestAnimationFrame(tick);
    }
    tick();
  }

  window.initOrbBackground = initOrbBackground;
})();

"use client";

import { useEffect, useRef } from "react";

export function LanternHero() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dead = false;
    let renderer: { dispose: () => void; domElement: HTMLCanvasElement } | null = null;
    let frame = 0;

    (async () => {
      const THREE = await import("three");
      if (dead) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, el.clientWidth / el.clientHeight, 0.1, 40);
      camera.position.set(0, 0.15, 3.4);

      const webgl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      webgl.setSize(el.clientWidth, el.clientHeight);
      webgl.setClearColor(0x000000, 0);
      el.appendChild(webgl.domElement);
      renderer = webgl;

      const lantern = new THREE.Group();
      const brass = new THREE.MeshStandardMaterial({
        color: 0xc2661b,
        metalness: 0.55,
        roughness: 0.35,
      });
      const glass = new THREE.MeshStandardMaterial({
        color: 0xfaf7f2,
        transparent: true,
        opacity: 0.45,
        roughness: 0.15,
      });
      const flameMat = new THREE.MeshStandardMaterial({
        color: 0xe69a41,
        emissive: 0xdd7f22,
        emissiveIntensity: 2.4,
        roughness: 0.4,
      });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.95, 6), glass);
      const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 1.02, 6, 1, true), brass);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.28, 6), brass);
      cap.position.y = 0.62;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.12, 6), brass);
      base.position.y = -0.54;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 16), brass);
      handle.position.y = 0.86;
      handle.rotation.x = Math.PI / 2;
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), flameMat);
      flame.position.y = 0.04;
      lantern.add(body, cage, cap, base, handle, flame);

      const light = new THREE.PointLight(0xe69a41, 4.5, 8);
      light.position.set(0, 0.1, 0.4);
      lantern.add(light);
      scene.add(lantern);
      scene.add(new THREE.AmbientLight(0xfaeacf, 0.55));
      const rim = new THREE.DirectionalLight(0xf4d29e, 0.8);
      rim.position.set(-2, 2, 3);
      scene.add(rim);

      const clock = new THREE.Clock();
      const tick = () => {
        if (dead) return;
        const t = clock.getElapsedTime();
        lantern.rotation.y = t * 0.45;
        lantern.position.y = Math.sin(t * 1.6) * 0.06;
        flame.scale.setScalar(0.92 + Math.sin(t * 9) * 0.08);
        flameMat.emissiveIntensity = 2.1 + Math.sin(t * 11) * 0.4;
        webgl.render(scene, camera);
        frame = requestAnimationFrame(tick);
      };
      tick();

      const onResize = () => {
        if (!el) return;
        camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
        camera.updateProjectionMatrix();
        webgl.setSize(el.clientWidth, el.clientHeight);
      };
      window.addEventListener("resize", onResize);
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(frame);
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, []);

  return <div ref={ref} className="h-48 w-full" aria-hidden />;
}

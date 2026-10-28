// card images. these are the demo photos from the liquid-glass-carousel repo —
// fine for local prototyping, NOT licensed for publishing (see its CREDITS.md).
// swap in your own files in public/img and edit this list.
import * as THREE from "three";

export const IMAGES = [
  "img/img12.jpg", "img/img3.png", "img/img8.png", "img/img9.png",
  "img/img11.png", "img/img1.png", "img/img2.png", "img/img4.png",
  "img/img5.png", "img/img6.png", "img/img7.png", "img/img10.png",
];

// returns [{ tex, aspect }]; aspect fills in once each image loads
export function loadCards(renderer, onLoad) {
  const loader = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return IMAGES.map((src) => {
    const card = { tex: null, aspect: 1, ready: false };
    card.tex = loader.load(src, (t) => {
      card.aspect = t.image.width / t.image.height;
      card.ready = true;
      onLoad && onLoad(card);
    });
    card.tex.colorSpace = THREE.SRGBColorSpace;
    card.tex.anisotropy = aniso;
    card.tex.minFilter = THREE.LinearMipmapLinearFilter;     // panels get small during the entry
    return card;
  });
}

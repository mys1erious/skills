// One entry per written lesson: its content, and its 3D scene loaded only when the reader gets there.
// book.json "lessons" lists every planned title; the contents page links only the lessons registered here.
import lesson1 from './0001.json';

export const lessons = {
  1: { content: lesson1, scene: () => import('./0001.scene.js') },
};

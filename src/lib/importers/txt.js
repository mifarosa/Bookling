import { splitParagraphs } from '../tokenize.js';

/** Decodes a text file as UTF-8, falling back to windows-1252 when UTF-8 is invalid. */
export async function readTextFile(file) {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

export function parseText(text, fallbackTitle = 'Untitled') {
  const blocks = splitParagraphs(text);
  return { title: fallbackTitle, author: '', language: '', blocks };
}

export async function importTxt(file) {
  const text = await readTextFile(file);
  return parseText(text, file.name.replace(/\.[^.]+$/, ''));
}

import { describe, expect, it } from 'vitest';
import { attr, childNamed, childrenNamed, parseXml } from './xml';

describe('parser XML mínimo de OOXML', () => {
  it('analiza elementos, atributos y texto con entidades', () => {
    const root = parseXml('<root a="1" b="dos"><child>hola &amp; adiós</child><empty/></root>');
    expect(root.tag).toBe('root');
    expect(attr(root, 'a')).toBe('1');
    expect(childrenNamed(root, 'child')[0].text).toBe('hola & adiós');
    expect(childNamed(root, 'empty')).toBeDefined();
  });

  it('conserva prefijos de namespace y referencias numéricas', () => {
    const root = parseXml('<w:p xmlns:w="urn:x"><w:r><w:t>caf&#233; &#x41;</w:t></w:r></w:p>');
    expect(root.tag).toBe('w:p');
    expect(childNamed(root, 'w:r')).toBeDefined();
    expect(root.children[0].children[0].text).toBe('café A');
  });

  it('ignora prólogo, comentarios y CDATA', () => {
    const root = parseXml('<?xml version="1.0"?><!-- nota --><root><![CDATA[<no> es xml]]></root>');
    expect(root.text).toBe('<no> es xml');
  });

  it('rechaza XML mal formado', () => {
    expect(() => parseXml('<root><child></root>')).toThrow();
    expect(() => parseXml('')).toThrow();
    expect(() => parseXml('<root>')).toThrow();
  });
});

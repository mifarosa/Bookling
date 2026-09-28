export function dictionaryUrl(template, term) {
  const encoded = encodeURIComponent(term);
  return template.includes('###') ? template.replaceAll('###', encoded) : template + encoded;
}

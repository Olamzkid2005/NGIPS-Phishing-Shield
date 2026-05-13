/**
 * Porter Stemmer (Porter2 / Snowball compatible) for English
 * Used to match sklearn's SnowballStemmer("english") during inference
 */

function isConsonant(str, i) {
  const ch = str[i];
  if (ch === 'a' || ch === 'e' || ch === 'i' || ch === 'o' || ch === 'u') return false;
  if (ch === 'y' && i > 0) return !isConsonant(str, i - 1);
  return true;
}

function measure(str) {
  let m = 0;
  let n = str.length;
  let i = 0;
  while (i < n && isConsonant(str, i)) i++;
  if (i >= n) return 0;
  while (i < n && !isConsonant(str, i)) i++;
  while (true) {
    while (i < n && isConsonant(str, i)) i++;
    if (i >= n) return m;
    m++;
    while (i < n && !isConsonant(str, i)) i++;
  }
}

function vowelInStem(str) {
  for (let i = 0; i < str.length; i++) {
    if (!isConsonant(str, i)) return true;
  }
  return false;
}

function doubleConsonant(str) {
  const n = str.length;
  if (n < 2) return false;
  const last = str[n - 1];
  if (last !== str[n - 2]) return false;
  return isConsonant(str, n - 1);
}

function cvc(str) {
  const n = str.length;
  if (n < 3) return false;
  if (!isConsonant(str, n - 1)) return false;
  if (isConsonant(str, n - 2)) return false;
  if (!isConsonant(str, n - 3)) return false;
  const last = str[n - 1];
  if (last === 'w' || last === 'x' || last === 'y') return false;
  return true;
}

function replace(str, suffix, replacement) {
  if (str.endsWith(suffix)) {
    const stem = str.slice(0, -suffix.length);
    return stem + replacement;
  }
  return str;
}

function replaceMeasure(str, suffix, replacement, minMeasure) {
  if (str.endsWith(suffix)) {
    const stem = str.slice(0, -suffix.length);
    if (measure(stem) > minMeasure) {
      return stem + replacement;
    }
  }
  return str;
}

function step1a(str) {
  if (str.endsWith('sses')) return str.slice(0, -4) + 'ss';
  if (str.endsWith('ies')) return str.slice(0, -3) + 'i';
  if (str.endsWith('ss')) return str;
  if (str.endsWith('s') && str.length > 2) {
    const stem = str.slice(0, -1);
    if (stem.length >= 1) return stem;
  }
  return str;
}

function step1b(str) {
  let result = str;
  if (result.endsWith('eed')) {
    result = replaceMeasure(result, 'eed', 'ee', 0);
  } else if (result.endsWith('ed')) {
    const stem = result.slice(0, -2);
    if (vowelInStem(stem)) {
      result = stem;
      result = step1bHelper(result);
    }
  } else if (result.endsWith('ing')) {
    const stem = result.slice(0, -3);
    if (vowelInStem(stem)) {
      result = stem;
      result = step1bHelper(result);
    }
  }
  return result;
}

function step1bHelper(str) {
  if (str.endsWith('at')) return str + 'e';
  if (str.endsWith('bl')) return str + 'e';
  if (str.endsWith('iz')) return str + 'e';
  if (doubleConsonant(str) && !str.endsWith('l') && !str.endsWith('s') && !str.endsWith('z')) {
    return str.slice(0, -1);
  }
  if (measure(str) === 1 && cvc(str)) return str + 'e';
  return str;
}

function step1c(str) {
  if (str.length > 2 && (str.endsWith('y') || str.endsWith('Y'))) {
    const stem = str.slice(0, -1);
    if (!isConsonant(str, str.length - 2)) return str;
    if (vowelInStem(stem)) return stem + 'i';
  }
  return str;
}

function step2(str) {
  const rules = [
    ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
    ['izer', 'ize'], ['abli', 'able'], ['alli', 'al'], ['entli', 'ent'],
    ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
    ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'],
    ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
  ];
  for (const [suffix, replacement] of rules) {
    if (str.endsWith(suffix)) {
      const stem = str.slice(0, -suffix.length);
      if (measure(stem) > 0) return stem + replacement;
    }
  }
  return str;
}

function step3(str) {
  const rules = [
    ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'],
    ['ical', 'ic'], ['ful', ''], ['ness', ''],
  ];
  for (const [suffix, replacement] of rules) {
    if (str.endsWith(suffix)) {
      const stem = str.slice(0, -suffix.length);
      if (measure(stem) > 0) return stem + replacement;
    }
  }
  return str;
}

function step4(str) {
  const suffixes = ['al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement', 'ment', 'ent', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize'];
  for (const suffix of suffixes) {
    if (str.endsWith(suffix)) {
      const stem = str.slice(0, -suffix.length);
      if (measure(stem) > 1) return stem;
    }
  }
  if (str.endsWith('ion')) {
    const stem = str.slice(0, -3);
    if (measure(stem) > 1 && (stem.endsWith('s') || stem.endsWith('t'))) return stem;
  }
  return str;
}

function step5(str) {
  let result = str;
  if (result.endsWith('e')) {
    const stem = result.slice(0, -1);
    if (measure(stem) > 1) return stem;
    if (measure(stem) === 1 && !cvc(stem)) return stem;
  }
  if (result.endsWith('l') && doubleConsonant(result) && measure(result) > 1) {
    return result.slice(0, -1);
  }
  return result;
}

export function stem(word) {
  if (word.length <= 2) return word;
  let w = word.toLowerCase();
  w = step1a(w);
  w = step1b(w);
  w = step1c(w);
  w = step2(w);
  w = step3(w);
  w = step4(w);
  w = step5(w);
  return w;
}

export default { stem };

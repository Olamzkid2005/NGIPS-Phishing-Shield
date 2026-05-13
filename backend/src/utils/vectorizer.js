/**
 * URL Vectorizer - Converts URLs to bag-of-words vectors
 * Mirrors sklearn's CountVectorizer with URLTokenizer + English stop_words
 * Loads vocabulary from training output for inference consistency
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { stem } from './stemmer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, '../../../ml-service/models');

// sklearn's ENGLISH_STOP_WORDS (318 words)
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'across', 'after', 'afterwards', 'again', 'against',
  'all', 'almost', 'alone', 'along', 'already', 'also', 'although', 'always',
  'am', 'among', 'amongst', 'amoungst', 'amount', 'an', 'and', 'another',
  'any', 'anyhow', 'anyone', 'anything', 'anyway', 'anywhere', 'are',
  'around', 'as', 'at', 'back', 'be', 'became', 'because', 'become',
  'becomes', 'becoming', 'been', 'before', 'beforehand', 'behind', 'being',
  'below', 'beside', 'besides', 'between', 'beyond', 'bill', 'both',
  'bottom', 'but', 'by', 'call', 'can', 'cannot', 'cant', 'co', 'computer',
  'con', 'could', 'couldnt', 'cry', 'de', 'describe', 'detail', 'do', 'done',
  'down', 'due', 'during', 'each', 'eg', 'eight', 'either', 'eleven', 'else',
  'elsewhere', 'empty', 'enough', 'etc', 'even', 'ever', 'every', 'everyone',
  'everything', 'everywhere', 'except', 'few', 'fifteen', 'fifty', 'fill',
  'find', 'fire', 'first', 'five', 'for', 'former', 'formerly', 'forty',
  'found', 'four', 'from', 'front', 'full', 'further', 'get', 'give', 'go',
  'had', 'has', 'hasnt', 'have', 'he', 'hence', 'her', 'here', 'hereafter',
  'hereby', 'herein', 'hereupon', 'hers', 'herself', 'him', 'himself', 'his',
  'how', 'however', 'hundred', 'i', 'ie', 'if', 'in', 'inc', 'indeed',
  'interest', 'into', 'is', 'it', 'its', 'itself', 'keep', 'last', 'latter',
  'latterly', 'least', 'less', 'ltd', 'made', 'many', 'may', 'me',
  'meanwhile', 'might', 'mill', 'mine', 'more', 'moreover', 'most', 'mostly',
  'move', 'much', 'must', 'my', 'myself', 'name', 'namely', 'neither',
  'never', 'nevertheless', 'next', 'nine', 'no', 'nobody', 'none', 'noone',
  'nor', 'not', 'nothing', 'now', 'nowhere', 'of', 'off', 'often', 'on',
  'once', 'one', 'only', 'onto', 'or', 'other', 'others', 'otherwise', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'part', 'per', 'perhaps',
  'please', 'put', 'rather', 're', 'same', 'see', 'seem', 'seemed',
  'seeming', 'seems', 'serious', 'several', 'she', 'should', 'show', 'side',
  'since', 'sincere', 'six', 'sixty', 'so', 'some', 'somehow', 'someone',
  'something', 'sometime', 'sometimes', 'somewhere', 'still', 'such',
  'system', 'take', 'ten', 'than', 'that', 'the', 'their', 'them',
  'themselves', 'then', 'thence', 'there', 'thereafter', 'thereby',
  'therefor', 'therein', 'thereupon', 'these', 'they', 'thick', 'thin',
  'third', 'this', 'those', 'though', 'three', 'through', 'throughout',
  'thru', 'thus', 'to', 'together', 'too', 'top', 'toward', 'towards',
  'twelve', 'twenty', 'two', 'un', 'under', 'until', 'up', 'upon', 'us',
  'very', 'via', 'was', 'we', 'well', 'were', 'what', 'whatever', 'when',
  'whence', 'whenever', 'where', 'whereafter', 'whereas', 'whereby',
  'wherein', 'whereupon', 'wherever', 'whether', 'which', 'while', 'whither',
  'who', 'whoever', 'whole', 'whom', 'why', 'will', 'with', 'within',
  'without', 'would', 'yet', 'you', 'your', 'yours', 'yourself', 'yourselves',
]);

class Vectorizer {
  constructor() {
    this.vocabulary = null;
    this.n_features = 0;
    this.modelName = '';
    this.loaded = false;
  }

  load(name) {
    const vocabPath = join(MODELS_DIR, `${name}_vocab.json`);
    if (!existsSync(vocabPath)) {
      throw new Error(`Vocabulary not found: ${vocabPath}`);
    }
    const raw = JSON.parse(readFileSync(vocabPath, 'utf-8'));
    this.vocabulary = raw.vocabulary;
    this.n_features = raw.n_features || 0;
    this.modelName = raw.model_name || name;
    this.loaded = true;
    console.log(`[ML] Loaded vocabulary: ${name} (${Object.keys(this.vocabulary).length} words)`);
  }

  tokenize(url) {
    // NOTE: Matches Python RegexpTokenizer(r'[A-Za-z]+') — drops numbers, IPs, ports.
    // This matches sklearn's CountVectorizer used in training exactly.
    return (url.toLowerCase().match(/[a-z]+/g) || []);
  }

  transform(url) {
    if (!this.loaded) throw new Error('Vectorizer not loaded');
    const tokens = this.tokenize(url);
    const vec = new Float32Array(this.n_features);

    for (let token of tokens) {
      if (STOP_WORDS.has(token)) continue;
      const stemmed = stem(token);
      const idx = this.vocabulary[stemmed];
      if (idx !== undefined) {
        vec[idx] += 1;
      }
    }
    return vec;
  }
}

export const vectorizers = {
  logistic_regression: new Vectorizer(),
  multinomial_nb: new Vectorizer(),
};

export function loadAllVectorizers() {
  for (const [name, vec] of Object.entries(vectorizers)) {
    try {
      vec.load(name);
    } catch (e) {
      console.warn(`[ML] Failed to load vectorizer ${name}: ${e.message}`);
    }
  }
  return Object.values(vectorizers).some(v => v.loaded);
}

export function vectorize(url, modelName = 'logistic_regression') {
  const vec = vectorizers[modelName];
  if (!vec || !vec.loaded) {
    throw new Error(`Vectorizer ${modelName} not loaded`);
  }
  return vec.transform(url);
}

export default { vectorizers, loadAllVectorizers, vectorize };

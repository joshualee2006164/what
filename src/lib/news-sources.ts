export type NewsSource = {
  id: string
  title: string
  name: string
  url: string
  text: string
  publishedAt: string
}

const trustedDomains = new Set([
  'abcnews.go.com', 'abcnews.com', 'abc.com.au', 'abc.net.au', 'abcnews.com.au', 'aljazeera.com', 'apnews.com', 'ap.org',
  'afp.com', 'arstechnica.com', 'afr.com', 'axios.com', 'barrons.com', 'bbc.com', 'bbc.co.uk', 'bloomberg.com',
  'businessinsider.com',
  'bostonglobe.com', 'business-standard.com', 'cbc.ca', 'cbsnews.com', 'channel4.com',
  'channelnewsasia.com', 'cnbc.com', 'cnn.com', 'csmonitor.com', 'ctvnews.ca', 'dailymaverick.co.za',
  'deccanherald.com', 'dw.com', 'economist.com', 'elpais.com', 'ewn.co.za', 'fortune.com',
  'foreignaffairs.com', 'foreignpolicy.com', 'france24.com', 'ft.com', 'globalnews.ca', 'hindustantimes.com',
  'independent.co.uk', 'indianexpress.com', 'iol.co.za', 'japantimes.co.jp', 'koreaherald.com',
  'latimes.com', 'mg.co.za', 'mint.com', 'mit.edu', 'nature.com', 'nbcnews.com', 'ndtv.com',
  'news24.com', 'news.sky.com', 'newsweek.com', 'npr.org', 'nytimes.com', 'pbs.org', 'politico.com',
  'politico.eu',
  'politifact.com', 'propublica.org', 'reuters.com', 'rfi.fr', 'scmp.com', 'science.org',
  'sciencenews.org', 'scientificamerican.com', 'scroll.in', 'sbs.com.au', 'seattletimes.com',
  'semfor.com', 'smh.com.au', 'standard.co.uk',
  'statnews.com', 'straitstimes.com', 'sydneymorningherald.com.au', 'techcrunch.com',
  'technologyreview.com', 'telegraph.co.uk', 'texastribune.org', 'theage.com.au', 'theglobeandmail.com',
  'theatlantic.com', 'theconversation.com', 'theguardian.com', 'thehill.com', 'thehindu.com',
  'theprint.in', 'thetimes.com', 'theverge.com', 'thewire.in', 'time.com', 'timeslive.co.za',
  'timesofindia.indiatimes.com',
  'usatoday.com', 'voanews.com', 'washingtonpost.com', 'wired.com', 'wsj.com',
])
const multiPartSuffixes = new Set([
  'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'com.au', 'net.au', 'org.au', 'edu.au',
  'co.nz', 'org.nz', 'co.jp', 'or.jp', 'com.br', 'com.mx', 'co.za', 'org.za',
  'co.in', 'org.in', 'com.in', 'co.kr', 'com.sg', 'com.hk', 'com.ph', 'com.my',
  'com.ng', 'com.pk', 'com.bd', 'com.eg', 'com.ar', 'com.co', 'com.tr',
])
const publisherAliases = new Map([
  ['abc.com.au', 'abc-au'], ['abc.net.au', 'abc-au'], ['abcnews.com.au', 'abc-au'],
  ['abcnews.com', 'abc-us'], ['abcnews.go.com', 'abc-us'],
  ['apnews.com', 'ap'], ['ap.org', 'ap'],
  ['bbc.com', 'bbc'], ['bbc.co.uk', 'bbc'],
])
const trackingParams = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid|ref|source)$/i
const commonWords = new Set('the a an and or but for with from into after before over under about against who what when where why how says said say to of in on at by as is are was were has have had this that it its their they them will would could should may might'.split(' '))

function hostFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    return url.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

function isTrustedHost(host: string): boolean {
  return host.endsWith('.gov') || host.endsWith('.gov.uk') || host.endsWith('.europa.eu') ||
    [...trustedDomains].some((domain) => host === domain || host.endsWith(`.${domain}`))
}

export function normalizeArticleUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.username || url.password || (url.port && url.port !== '80' && url.port !== '443')) return null
    const rawHost = url.hostname.toLowerCase().replace(/^www\./, '')
    if (url.protocol === 'http:' && isTrustedHost(rawHost)) url.protocol = 'https:'
    if (url.protocol !== 'https:') return null
    const mobileHost = rawHost.replace(/^(?:m|mobile|amp)\./, '')
    url.hostname = mobileHost !== rawHost && isTrustedHost(mobileHost) ? mobileHost : rawHost
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) if (trackingParams.test(key)) url.searchParams.delete(key)
    url.searchParams.sort()
    url.pathname = (url.pathname.replace(/\/(?:amp(?:\.html)?|mobile)\/?$/i, '').replace(/\/+$/, '') || '/')
    return url.toString()
  } catch {
    return null
  }
}

export function publisherKey(raw: string): string | null {
  const rawHost = hostFromUrl(raw)
  if (!rawHost) return null
  const host = rawHost.replace(/^(?:m|mobile|amp)\./, '')
  const matchingRoot = [...trustedDomains]
    .filter((domain) => host === domain || host.endsWith(`.${domain}`))
    .sort((left, right) => right.length - left.length)[0]
  if (matchingRoot) return publisherAliases.get(matchingRoot) ?? matchingRoot
  const parts = host.split('.').filter(Boolean)
  if (parts.length < 2) return null
  const suffix = parts.slice(-2).join('.')
  return multiPartSuffixes.has(suffix) && parts.length >= 3 ? parts.slice(-3).join('.') : suffix
}

export function hasIndependentPublisherCount(sources: NewsSource[], minimum = 2): boolean {
  const publishers = new Set(sources.map((source) => publisherKey(source.url)).filter((key): key is string => !!key))
  return publishers.size >= minimum
}

export function isTrustedNewsPublisher(raw: string): boolean {
  const host = hostFromUrl(raw)
  return host ? isTrustedHost(host) : false
}

function normalizedWords(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/https?:\/\/\S+/g, ' ').match(/[a-z0-9]{3,}/g) ?? [])
}

function similarity(left: string, right: string): number {
  const a = normalizedWords(left)
  const b = normalizedWords(right)
  if (!a.size || !b.size) return 0
  const intersection = [...a].filter((word) => b.has(word)).length
  return intersection / (a.size + b.size - intersection)
}

export function likelySameEventArticle(candidateHeadline: string, articleTitle: string, candidateDetails = ''): boolean {
  const titleWords = [...normalizedWords(candidateHeadline)].filter((word) => !commonWords.has(word))
  const detailWords = [...normalizedWords(candidateDetails)].filter((word) => !commonWords.has(word))
  const articleWords = normalizedWords(articleTitle)
  const titleShared = titleWords.filter((word) => articleWords.has(word)).length
  const detailShared = detailWords.filter((word) => articleWords.has(word)).length
  const allWords = new Set([...titleWords, ...detailWords])
  const shared = [...allWords].filter((word) => articleWords.has(word)).length
  const coverage = shared / Math.max(1, Math.min(allWords.size, articleWords.size))
  return (titleShared >= 2 && titleShared / Math.max(1, Math.min(titleWords.length, articleWords.size)) >= 0.24) ||
    (titleShared >= 1 && detailShared >= 2 && coverage >= 0.2)
}

const queryStopWords = new Set([...commonWords, 'news', 'report', 'reports', 'reporting', 'story', 'says', 'according', 'latest', 'update'])

export function buildExaSearchQuery(title: string, description: string, publishedAt: string): string {
  const titleTerms = [...normalizedWords(title)]
  const seen = new Set(titleTerms)
  const detailTerms = [...normalizedWords(description)].filter((word) => {
    if (queryStopWords.has(word) || seen.has(word)) return false
    seen.add(word)
    return true
  }).slice(0, 8)
  const date = Number.isFinite(Date.parse(publishedAt)) ? publishedAt.slice(0, 10) : ''
  return [
    titleTerms.join(' ').slice(0, 170),
    detailTerms.join(' ').slice(0, 100),
    date,
    'independent reporting',
  ].filter(Boolean).join(' ')
}

/** Conservative near-copy check to avoid treating syndicated wire text as independent confirmation. */
export function looksSyndicatedCopy(left: NewsSource, right: NewsSource): boolean {
  const sameHeadline = similarity(left.title, right.title) >= 0.78
  const sameText = similarity(left.text, right.text) >= 0.72
  return sameText || (sameHeadline && similarity(left.text, right.text) >= 0.48)
}

/** Keep the best first occurrence per canonical URL, publisher, and near-identical article text. */
export function independentSources(sources: NewsSource[]): { sources: NewsSource[]; duplicates: number; rejectedQuality: number } {
  const accepted: NewsSource[] = []
  const urls = new Set<string>()
  const publishers = new Set<string>()
  let duplicates = 0
  let rejectedQuality = 0

  for (const source of sources) {
    const url = normalizeArticleUrl(source.url)
    const publisher = publisherKey(source.url)
    const hasReporting = source.text.trim().length >= 160
    if (!url || !publisher || !isTrustedNewsPublisher(source.url) || !hasReporting) {
      rejectedQuality += 1
      continue
    }
    if (urls.has(url) || publishers.has(publisher) || accepted.some((item) => looksSyndicatedCopy(source, item))) {
      duplicates += 1
      continue
    }
    urls.add(url)
    publishers.add(publisher)
    accepted.push({ ...source, url })
  }
  return { sources: accepted, duplicates, rejectedQuality }
}

/** Similarity is intentionally high: only obvious duplicate-event headlines collapse. */
export function likelySameNewsEvent(left: string, right: string): boolean {
  return similarity(left, right) >= 0.84
}

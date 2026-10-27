import math
import re
from typing import List, Dict, Tuple, Any

HINDI_ENGLISH_MAP = {
    "धान": "rice paddy",
    "चावल": "rice",
    "अनानास": "pineapple ananas comosus",
    "पाइनएप्पल": "pineapple ananas",
    "रोग": "disease rot spot blight wilt infection pathogen",
    "बीमारी": "disease infection wilt rot spot pathogen",
    "बीमारियां": "disease diseases rot spot blight wilt infection",
    "कीट": "pest insect borer bug mealybug thrips mite aphid",
    "इलाज": "management control spray treatment fungicide pesticide remedy",
    "उपचार": "treatment management remedy spray control",
    "रोकथाम": "prevention management control spray cultural sanitation",
    "दवा": "fungicide pesticide chemical dose spray treatment",
    "हार्ट": "heart rot phytophthora top rot",
    "सड़न": "rot decay softening decomposition",
    "पत्ती": "leaf foliage leaf-spot leaves blade",
    "पत्तियां": "leaves foliage leaf blades",
    "पत्तियों": "leaves foliage leaf blades",
    "धब्बा": "spot lesion chlorosis blotch",
    "धब्बे": "spots lesions chlorosis blotches",
    "ब्लास्ट": "blast pyricularia",
    "मिट्टी": "soil acidic liming lime ph drainage",
    "खाद": "fertilizer npk urea compost fym manure nutrient",
    "किस्म": "variety varieties cultivar queen kew mauritius rcm tamphaphou chak-hao",
    "किस्में": "varieties variety cultivars queen kew mauritius",
    "मणिपुर": "manipur churachandpur thoubal andro khousabung",
    "सूखा": "drought water stress waterlogging dry moisture",
    "तनाव": "stress water-stress moisture drought deficiency",
    "भूरा": "brown browning scorch necrosis coppery",
    "भूरे": "brown browning scorch necrosis coppery",
    "भूरापन": "browning necrosis bronze coppery",
    "पीला": "yellow chlorosis yellowing pale",
    "पीली": "yellow chlorosis yellowing pale",
    "रोपाई": "planting transplanting season calendar july august february",
    "बुवाई": "sowing planting season july august february",
    "कटाई": "harvest harvesting season maturity june september",
    "मौसम": "season calendar weather monsoon winter",
    "सिंचाई": "irrigation water watering drainage moisture",
    "मिलीबग": "mealybug wilt dysmicoccus ant ants",
    "विल्ट": "wilt wilting collapse",
}

# Synonyms for topic-level expansion
QUERY_EXPANSIONS = {
    "major diseases": "phytophthora heart rot root rot base rot fruitlet core rot mealybug wilt white leaf spot yellow spot pathogen fungus",
    "water stress": "drought moisture irrigation waterlogging dry limp rolled leaves firm heart leaves rot vs stress",
    "brown": "browning tips necrosis scorch sunburn potassium deficiency wilt rot",
    "varieties": "queen gi kew giant kew mauritius cultivar varieties",
    "planting": "planting season calendar suckers slips crowns spacing july august february april",
    "harvest": "harvesting season maturity indices color break june september yield",
    "prevent": "prevention management cultural raised beds drainage fungicide dip spray",
}

def tokenize(text: str) -> List[str]:
    # Lowercase and split on non-alphanumeric characters
    tokens = re.findall(r"[\w\u0900-\u097F]+", text.lower())
    expanded = []
    
    # Check query expansions
    text_lower = text.lower()
    for phrase, extra in QUERY_EXPANSIONS.items():
        if phrase in text_lower:
            for extra_token in extra.split():
                expanded.append(extra_token)

    for token in tokens:
        expanded.append(token)
        if token in HINDI_ENGLISH_MAP:
            for mapped in HINDI_ENGLISH_MAP[token].split():
                expanded.append(mapped)
                
    return expanded

class BM25Retriever:
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus_size = 0
        self.avg_doc_len = 0.0
        self.doc_lengths: List[int] = []
        self.doc_freqs: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}
        self.doc_token_counts: List[Dict[str, int]] = []
        self.chunks: List[Any] = []

    def index(self, chunks: List[Any]):
        self.chunks = chunks
        self.corpus_size = len(chunks)
        self.doc_lengths = []
        self.doc_token_counts = []
        self.doc_freqs = {}

        total_length = 0

        for chunk in chunks:
            text = f"{chunk.source} {chunk.title} {chunk.crop} {chunk.text}"
            tokens = tokenize(text)
            length = len(tokens)
            self.doc_lengths.append(length)
            total_length += length

            counts: Dict[str, int] = {}
            for t in tokens:
                counts[t] = counts.get(t, 0) + 1
            self.doc_token_counts.append(counts)

            for t in set(tokens):
                self.doc_freqs[t] = self.doc_freqs.get(t, 0) + 1

        self.avg_doc_len = total_length / self.corpus_size if self.corpus_size > 0 else 0.0

        # Calculate IDF with smoothing
        self.idf = {}
        for token, freq in self.doc_freqs.items():
            self.idf[token] = math.log(1.0 + (self.corpus_size - freq + 0.5) / (freq + 0.5))

    def retrieve(self, query: str, top_k: int = 6, crop_filter: str = None) -> List[Tuple[Any, float]]:
        if not self.chunks or self.corpus_size == 0:
            return []

        query_tokens = tokenize(query)
        scores = [0.0] * self.corpus_size

        for token in query_tokens:
            if token not in self.idf:
                continue
            idf_val = self.idf[token]

            for i, counts in enumerate(self.doc_token_counts):
                tf = counts.get(token, 0)
                if tf == 0:
                    continue
                doc_len = self.doc_lengths[i]
                numerator = tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avg_doc_len))
                scores[i] += idf_val * (numerator / denominator)

        # Apply crop filter or bonus if crop is specified
        if crop_filter and crop_filter in ["pineapple", "rice"]:
            for i, chunk in enumerate(self.chunks):
                if chunk.crop == crop_filter:
                    scores[i] *= 1.4
                elif chunk.crop != "general" and chunk.crop != crop_filter:
                    scores[i] *= 0.3

        # Rank results with diversity to prevent clumping on a single page
        ranked_indices = sorted(range(self.corpus_size), key=lambda idx: scores[idx], reverse=True)
        
        selected: List[Tuple[Any, float]] = []
        seen_page_keys: Dict[str, int] = {}

        for idx in ranked_indices:
            if scores[idx] <= 0.05:
                break
            chunk = self.chunks[idx]
            page_key = f"{chunk.source}_{chunk.page}"
            
            # Allow at most 2 chunks from same page to ensure broader context coverage
            if seen_page_keys.get(page_key, 0) >= 2:
                continue
                
            seen_page_keys[page_key] = seen_page_keys.get(page_key, 0) + 1
            selected.append((chunk, scores[idx]))
            
            if len(selected) >= top_k:
                break

        return selected

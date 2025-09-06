// Simple language detection patterns for common languages
const LANGUAGE_PATTERNS = {
  english: /^[a-zA-Z\s\d\p{P}]+$/u,
  tamil: /[\u0B80-\u0BFF]/,
  hindi: /[\u0900-\u097F]/,
  arabic: /[\u0600-\u06FF]/,
  chinese: /[\u4e00-\u9fff]/,
  japanese: /[\u3040-\u309f\u30a0-\u30ff]/,
  korean: /[\uac00-\ud7af]/
};

/**
 * Language detection result interface
 */
export interface LanguageDetectionResult {
  detected_language: string;
  confidence: number;
  is_tanglish: boolean;
  tamil_ratio: number;
}

/**
 * Tamil Unicode character ranges
 * Tamil block: U+0B80–U+0BFF
 */
const TAMIL_UNICODE_RANGES = [
  { start: 0x0B80, end: 0x0BFF }, // Tamil block
];

/**
 * Common Tamil characters for more precise detection
 */
const COMMON_TAMIL_CHARS = [
  'அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ',
  'க', 'ங', 'ச', 'ஞ', 'ட', 'ண', 'த', 'ந', 'ப', 'ம', 'ய', 'ர', 'ல', 'வ', 'ழ', 'ள', 'ற', 'ன',
  'ா', 'ி', 'ீ', 'ு', 'ூ', 'ெ', 'ே', 'ை', 'ொ', 'ோ', 'ௌ', '்'
];

/**
 * Utility class for Tamil Unicode character detection
 */
export class TamilDetectionUtils {
  /**
   * Check if a character is in Tamil Unicode range
   */
  static isTamilCharacter(char: string): boolean {
    const codePoint = char.codePointAt(0);
    if (!codePoint) return false;

    return TAMIL_UNICODE_RANGES.some(
      range => codePoint >= range.start && codePoint <= range.end
    );
  }

  /**
   * Count Tamil characters in text
   */
  static countTamilCharacters(text: string): number {
    let count = 0;
    for (const char of text) {
      if (this.isTamilCharacter(char)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Count total meaningful characters (excluding spaces and punctuation)
   */
  static countMeaningfulCharacters(text: string): number {
    // Remove spaces, punctuation, and numbers
    const meaningfulText = text.replace(/[\s\p{P}\p{N}]/gu, '');
    return meaningfulText.length;
  }

  /**
   * Calculate Tamil character ratio in text
   */
  static calculateTamilRatio(text: string): number {
    const tamilCount = this.countTamilCharacters(text);
    const totalCount = this.countMeaningfulCharacters(text);
    
    if (totalCount === 0) return 0;
    return tamilCount / totalCount;
  }

  /**
   * Check if text contains common Tamil words/patterns
   */
  static hasCommonTamilPatterns(text: string): boolean {
    return COMMON_TAMIL_CHARS.some(char => text.includes(char));
  }
}

/**
 * Tanglish ratio calculation algorithm
 */
export class TanglishDetector {
  private static readonly TANGLISH_THRESHOLD = 0.1; // 10% Tamil characters minimum
  private static readonly HIGH_TANGLISH_THRESHOLD = 0.4; // 40% Tamil characters for high confidence

  /**
   * Calculate Tanglish ratio and determine if text is Tanglish
   */
  static calculateTanglishRatio(text: string): { ratio: number; isTanglish: boolean; confidence: number } {
    const tamilRatio = TamilDetectionUtils.calculateTamilRatio(text);
    const hasLatinChars = /[a-zA-Z]/.test(text);
    const hasTamilChars = TamilDetectionUtils.hasCommonTamilPatterns(text);
    
    // Text is Tanglish if it has both Tamil and Latin characters
    const isTanglish = hasTamilChars && hasLatinChars && tamilRatio >= this.TANGLISH_THRESHOLD;
    
    // Calculate confidence based on ratio and character mix
    let confidence = 0;
    if (isTanglish) {
      if (tamilRatio >= this.HIGH_TANGLISH_THRESHOLD) {
        confidence = 0.9; // High confidence for high Tamil ratio
      } else if (tamilRatio >= 0.2) {
        confidence = 0.7; // Medium confidence
      } else {
        confidence = 0.5; // Low confidence but still detected
      }
    }

    return {
      ratio: tamilRatio,
      isTanglish,
      confidence
    };
  }
}

/**
 * Simple pattern-based language detection
 */
export class SimpleLanguageDetector {
  /**
   * Detect language using simple patterns
   */
  static detectWithPatterns(text: string): { language: string; confidence: number } {
    const cleanText = text.trim().toLowerCase();
    
    if (!cleanText) {
      return { language: 'unknown', confidence: 0 };
    }

    // Check for Tamil characters
    if (LANGUAGE_PATTERNS.tamil.test(text)) {
      const tamilRatio = TamilDetectionUtils.calculateTamilRatio(text);
      if (tamilRatio > 0.8) {
        return { language: 'tamil', confidence: 0.9 };
      }
    }

    // Check for other languages
    for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
      if (lang === 'tamil') continue; // Already checked above
      
      if (pattern.test(text)) {
        const confidence = this.calculatePatternConfidence(text, pattern);
        if (confidence > 0.5) {
          return { language: lang, confidence };
        }
      }
    }

    // Default to English if mostly Latin characters
    if (LANGUAGE_PATTERNS.english.test(text)) {
      return { language: 'english', confidence: 0.7 };
    }

    return { language: 'unknown', confidence: 0.3 };
  }

  /**
   * Calculate confidence based on pattern matching
   */
  private static calculatePatternConfidence(text: string, pattern: RegExp): number {
    const matches = text.match(pattern);
    if (!matches) return 0;
    
    const matchLength = matches.join('').length;
    const totalLength = text.length;
    
    if (totalLength === 0) return 0;
    
    const ratio = matchLength / totalLength;
    return Math.min(0.9, ratio * 0.8 + 0.1); // Scale to 0.1-0.9 range
  }

  /**
   * Enhanced detection with common word patterns
   */
  static detectWithEnhancedPatterns(text: string): { language: string; confidence: number } {
    const basicResult = this.detectWithPatterns(text);
    
    // Common English words
    const englishWords = ['the', 'and', 'is', 'are', 'was', 'were', 'have', 'has', 'will', 'would', 'could', 'should'];
    const englishWordCount = englishWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;
    
    if (englishWordCount >= 2 && basicResult.language === 'english') {
      return { language: 'english', confidence: Math.min(0.9, basicResult.confidence + 0.2) };
    }
    
    return basicResult;
  }
}

/**
 * Main language detection service with confidence scoring
 */
export class LanguageDetectionService {
  private static readonly MIN_TEXT_LENGTH = 3;
  private static readonly CONFIDENCE_THRESHOLD = 0.5;

  /**
   * Detect language with comprehensive analysis
   */
  static async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    // Validate input
    if (!text || text.trim().length < this.MIN_TEXT_LENGTH) {
      return {
        detected_language: 'unknown',
        confidence: 0,
        is_tanglish: false,
        tamil_ratio: 0
      };
    }

    const cleanText = text.trim();
    
    // First, check for Tanglish
    const tanglishResult = TanglishDetector.calculateTanglishRatio(cleanText);
    
    if (tanglishResult.isTanglish) {
      return {
        detected_language: 'tanglish',
        confidence: tanglishResult.confidence,
        is_tanglish: true,
        tamil_ratio: tanglishResult.ratio
      };
    }

    // Check if it's pure Tamil
    const tamilRatio = TamilDetectionUtils.calculateTamilRatio(cleanText);
    if (tamilRatio > 0.8) {
      return {
        detected_language: 'tamil',
        confidence: 0.9,
        is_tanglish: false,
        tamil_ratio: tamilRatio
      };
    }

    // Use simple pattern detection for other languages
    const fallbackResult = SimpleLanguageDetector.detectWithEnhancedPatterns(cleanText);
    
    return {
      detected_language: fallbackResult.language,
      confidence: fallbackResult.confidence,
      is_tanglish: false,
      tamil_ratio: tamilRatio
    };
  }

  /**
   * Batch language detection for multiple texts
   */
  static async detectLanguageBatch(texts: string[]): Promise<LanguageDetectionResult[]> {
    const results = await Promise.all(
      texts.map(text => this.detectLanguage(text))
    );
    return results;
  }

  /**
   * Check if detection result is reliable
   */
  static isReliableDetection(result: LanguageDetectionResult): boolean {
    return result.confidence >= this.CONFIDENCE_THRESHOLD;
  }
}
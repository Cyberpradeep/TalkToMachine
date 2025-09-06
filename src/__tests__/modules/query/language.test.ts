import {
  LanguageDetectionResult,
  TamilDetectionUtils,
  TanglishDetector,
  SimpleLanguageDetector,
  LanguageDetectionService
} from '../../../modules/query/language';

describe('TamilDetectionUtils', () => {
  describe('isTamilCharacter', () => {
    it('should detect Tamil characters correctly', () => {
      expect(TamilDetectionUtils.isTamilCharacter('அ')).toBe(true);
      expect(TamilDetectionUtils.isTamilCharacter('க')).toBe(true);
      expect(TamilDetectionUtils.isTamilCharacter('்')).toBe(true);
      expect(TamilDetectionUtils.isTamilCharacter('ா')).toBe(true);
    });

    it('should not detect non-Tamil characters as Tamil', () => {
      expect(TamilDetectionUtils.isTamilCharacter('a')).toBe(false);
      expect(TamilDetectionUtils.isTamilCharacter('1')).toBe(false);
      expect(TamilDetectionUtils.isTamilCharacter(' ')).toBe(false);
      expect(TamilDetectionUtils.isTamilCharacter('!')).toBe(false);
    });

    it('should handle empty or invalid input', () => {
      expect(TamilDetectionUtils.isTamilCharacter('')).toBe(false);
    });
  });

  describe('countTamilCharacters', () => {
    it('should count Tamil characters correctly', () => {
      expect(TamilDetectionUtils.countTamilCharacters('வணக்கம்')).toBe(7);
      expect(TamilDetectionUtils.countTamilCharacters('hello')).toBe(0);
      expect(TamilDetectionUtils.countTamilCharacters('வணக்கம் hello')).toBe(7);
    });

    it('should handle empty string', () => {
      expect(TamilDetectionUtils.countTamilCharacters('')).toBe(0);
    });
  });

  describe('countMeaningfulCharacters', () => {
    it('should count meaningful characters excluding spaces and punctuation', () => {
      expect(TamilDetectionUtils.countMeaningfulCharacters('hello world')).toBe(10);
      expect(TamilDetectionUtils.countMeaningfulCharacters('hello, world!')).toBe(10);
      expect(TamilDetectionUtils.countMeaningfulCharacters('வணக்கம் நண்பர்களே!')).toBe(16);
    });

    it('should return 0 for strings with only spaces and punctuation', () => {
      expect(TamilDetectionUtils.countMeaningfulCharacters('   !!! ')).toBe(0);
    });
  });

  describe('calculateTamilRatio', () => {
    it('should calculate Tamil ratio correctly', () => {
      // Pure Tamil text
      const tamilRatio = TamilDetectionUtils.calculateTamilRatio('வணக்கம்');
      expect(tamilRatio).toBe(1);

      // Pure English text
      const englishRatio = TamilDetectionUtils.calculateTamilRatio('hello');
      expect(englishRatio).toBe(0);

      // Mixed text
      const mixedRatio = TamilDetectionUtils.calculateTamilRatio('வணக்கம் hello');
      expect(mixedRatio).toBeCloseTo(0.58, 2); // 7 Tamil chars out of 12 total
    });

    it('should return 0 for empty or meaningless text', () => {
      expect(TamilDetectionUtils.calculateTamilRatio('')).toBe(0);
      expect(TamilDetectionUtils.calculateTamilRatio('   ')).toBe(0);
    });
  });

  describe('hasCommonTamilPatterns', () => {
    it('should detect common Tamil patterns', () => {
      expect(TamilDetectionUtils.hasCommonTamilPatterns('வணக்கம்')).toBe(true);
      expect(TamilDetectionUtils.hasCommonTamilPatterns('நல்லா இருக்கீங்களா?')).toBe(true);
    });

    it('should not detect Tamil patterns in non-Tamil text', () => {
      expect(TamilDetectionUtils.hasCommonTamilPatterns('hello world')).toBe(false);
      expect(TamilDetectionUtils.hasCommonTamilPatterns('123456')).toBe(false);
    });
  });
});

describe('TanglishDetector', () => {
  describe('calculateTanglishRatio', () => {
    it('should detect Tanglish text correctly', () => {
      const result = TanglishDetector.calculateTanglishRatio('வணக்கம் hello');
      expect(result.isTanglish).toBe(true);
      expect(result.ratio).toBeGreaterThan(0.1);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect high-confidence Tanglish', () => {
      const result = TanglishDetector.calculateTanglishRatio('வணக்கம் நண்பர்களே how are you?');
      expect(result.isTanglish).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should not detect pure Tamil as Tanglish', () => {
      const result = TanglishDetector.calculateTanglishRatio('வணக்கம் நண்பர்களே');
      expect(result.isTanglish).toBe(false);
    });

    it('should not detect pure English as Tanglish', () => {
      const result = TanglishDetector.calculateTanglishRatio('hello world');
      expect(result.isTanglish).toBe(false);
    });

    it('should handle edge cases with minimal Tamil content', () => {
      const result = TanglishDetector.calculateTanglishRatio('hello வணக்கம் world test test test test');
      expect(result.isTanglish).toBe(true);
      expect(result.confidence).toBeLessThanOrEqual(0.7); // Lower confidence due to low Tamil ratio
    });

    it('should handle empty or invalid input', () => {
      const result = TanglishDetector.calculateTanglishRatio('');
      expect(result.isTanglish).toBe(false);
      expect(result.ratio).toBe(0);
      expect(result.confidence).toBe(0);
    });
  });
});

describe('SimpleLanguageDetector', () => {
  describe('detectWithPatterns', () => {
    it('should detect English text', () => {
      const result = SimpleLanguageDetector.detectWithPatterns('This is a test sentence in English');
      expect(result.language).toBe('english');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Tamil text', () => {
      const result = SimpleLanguageDetector.detectWithPatterns('வணக்கம் நண்பர்களே');
      expect(result.language).toBe('tamil');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should handle empty text gracefully', () => {
      const result = SimpleLanguageDetector.detectWithPatterns('');
      expect(result.language).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should handle mixed scripts', () => {
      const result = SimpleLanguageDetector.detectWithPatterns('Hello 123 !@#');
      expect(result.language).toBe('english');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('detectWithEnhancedPatterns', () => {
    it('should boost confidence for English with common words', () => {
      const result = SimpleLanguageDetector.detectWithEnhancedPatterns('This is the best test and it will work');
      expect(result.language).toBe('english');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should handle text without common English words', () => {
      const result = SimpleLanguageDetector.detectWithEnhancedPatterns('xyz abc def');
      expect(result.language).toBe('english');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('LanguageDetectionService', () => {
  describe('detectLanguage', () => {
    it('should detect Tanglish correctly', async () => {
      const result = await LanguageDetectionService.detectLanguage('வணக்கம் hello world');
      expect(result.detected_language).toBe('tanglish');
      expect(result.is_tanglish).toBe(true);
      expect(result.tamil_ratio).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect pure Tamil correctly', async () => {
      const result = await LanguageDetectionService.detectLanguage('வணக்கம் நண்பர்களே எப்படி இருக்கீங்க');
      expect(result.detected_language).toBe('tamil');
      expect(result.is_tanglish).toBe(false);
      expect(result.tamil_ratio).toBeGreaterThan(0.8);
      expect(result.confidence).toBe(0.9);
    });

    it('should use pattern detection for other languages', async () => {
      const result = await LanguageDetectionService.detectLanguage('This is a test sentence in English');
      expect(result.detected_language).toBe('english');
      expect(result.is_tanglish).toBe(false);
      expect(result.tamil_ratio).toBe(0);
    });

    it('should handle very short text', async () => {
      const result = await LanguageDetectionService.detectLanguage('hi');
      expect(result.detected_language).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty or invalid input', async () => {
      const result = await LanguageDetectionService.detectLanguage('');
      expect(result.detected_language).toBe('unknown');
      expect(result.confidence).toBe(0);
      expect(result.is_tanglish).toBe(false);
      expect(result.tamil_ratio).toBe(0);
    });

    it('should handle text that is too short', async () => {
      const result = await LanguageDetectionService.detectLanguage('a');
      expect(result.detected_language).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should handle whitespace-only text', async () => {
      const result = await LanguageDetectionService.detectLanguage('   ');
      expect(result.detected_language).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('detectLanguageBatch', () => {
    it('should detect languages for multiple texts', async () => {
      const texts = [
        'வணக்கம் hello',
        'This is English',
        'வணக்கம் நண்பர்களே'
      ];
      
      const results = await LanguageDetectionService.detectLanguageBatch(texts);
      expect(results).toHaveLength(3);
      expect(results[0].is_tanglish).toBe(true);
      expect(results[1].detected_language).toBeDefined();
      expect(results[2].detected_language).toBe('tamil');
    });

    it('should handle empty array', async () => {
      const results = await LanguageDetectionService.detectLanguageBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('isReliableDetection', () => {
    it('should identify reliable detections', () => {
      const reliableResult: LanguageDetectionResult = {
        detected_language: 'tanglish',
        confidence: 0.8,
        is_tanglish: true,
        tamil_ratio: 0.5
      };
      
      expect(LanguageDetectionService.isReliableDetection(reliableResult)).toBe(true);
    });

    it('should identify unreliable detections', () => {
      const unreliableResult: LanguageDetectionResult = {
        detected_language: 'unknown',
        confidence: 0.3,
        is_tanglish: false,
        tamil_ratio: 0
      };
      
      expect(LanguageDetectionService.isReliableDetection(unreliableResult)).toBe(false);
    });
  });
});

// Integration tests for real-world scenarios
describe('Language Detection Integration Tests', () => {
  const testCases = [
    {
      text: 'வணக்கம் how are you?',
      expected: { language: 'tanglish', isTanglish: true }
    },
    {
      text: 'நல்லா இருக்கீங்களா? I am fine',
      expected: { language: 'tanglish', isTanglish: true }
    },
    {
      text: 'வணக்கம் நண்பர்களே எல்லாரும் எப்படி இருக்கீங்க',
      expected: { language: 'tamil', isTanglish: false }
    },
    {
      text: 'Hello, how are you doing today?',
      expected: { language: 'english', isTanglish: false }
    },
    {
      text: 'Simple text without special characters',
      expected: { language: 'english', isTanglish: false }
    }
  ];

  testCases.forEach(({ text, expected }, index) => {
    it(`should correctly detect language for test case ${index + 1}: "${text.substring(0, 20)}..."`, async () => {
      const result = await LanguageDetectionService.detectLanguage(text);
      
      expect(result.is_tanglish).toBe(expected.isTanglish);
      
      if (expected.language) {
        expect(result.detected_language).toBe(expected.language);
      }
      
      // All test cases should have some confidence
      expect(result.confidence).toBeGreaterThan(0);
    });
  });
});

// Performance tests
describe('Language Detection Performance Tests', () => {
  it('should handle large text efficiently', async () => {
    const largeText = 'வணக்கம் hello world '.repeat(1000);
    const startTime = Date.now();
    
    const result = await LanguageDetectionService.detectLanguage(largeText);
    const endTime = Date.now();
    
    expect(result.detected_language).toBe('tanglish');
    expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
  });

  it('should handle batch processing efficiently', async () => {
    const texts = Array(100).fill('வணக்கம் hello world');
    const startTime = Date.now();
    
    const results = await LanguageDetectionService.detectLanguageBatch(texts);
    const endTime = Date.now();
    
    expect(results).toHaveLength(100);
    expect(results.every(r => r.is_tanglish)).toBe(true);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });
});
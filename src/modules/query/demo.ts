import { LanguageDetectionService } from './language';

/**
 * Demo script to showcase language detection capabilities
 */
async function demonstrateLanguageDetection() {
  console.log('🔍 Language Detection Demo\n');

  const testCases = [
    'வணக்கம் how are you?',
    'நல்லா இருக்கீங்களா? I am fine',
    'வணக்கம் நண்பர்களே எல்லாரும் எப்படி இருக்கீங்க',
    'Hello, how are you doing today?',
    'This is a simple English sentence',
    'வணக்கம்',
    'hi',
    '',
    'வணக்கம் hello world test test test test test'
  ];

  for (const text of testCases) {
    const result = await LanguageDetectionService.detectLanguage(text);
    console.log(`Text: "${text}"`);
    console.log(`  Language: ${result.detected_language}`);
    console.log(`  Confidence: ${result.confidence.toFixed(2)}`);
    console.log(`  Is Tanglish: ${result.is_tanglish}`);
    console.log(`  Tamil Ratio: ${result.tamil_ratio.toFixed(2)}`);
    console.log(`  Reliable: ${LanguageDetectionService.isReliableDetection(result)}`);
    console.log('');
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateLanguageDetection().catch(console.error);
}

export { demonstrateLanguageDetection };
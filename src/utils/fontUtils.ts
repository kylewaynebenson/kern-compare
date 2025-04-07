import opentype from 'opentype.js';

// Define interfaces - UPDATED
interface Font {
  // Retain essential properties from opentype.Font
  getKerningValue: (leftGlyph: any, rightGlyph: any) => number;
  charToGlyph: (char: string) => any;
  glyphs?: { length: number };
  
  // Add custom properties
  nameToGlyph?: (name: string) => Glyph | undefined;
  unitsPerEm: number;
  tables?: Record<string, any>;  // Use generic record type for tables
  names?: {
    fullName?: {
      en: string;
    };
  };
  outlinesFormat?: string;
}

// Rest of the interfaces remain the same
interface Glyph {
  unicode?: number;
}

interface FontData {
  font: Font;
  url: string;
  name: string;
  fileName: string;
  kerningPairs: Record<string, number>;
  glyphCount: number;
  unitsPerEm: number;
  format: string;
  note?: string;
}

interface CharacterFrequency {
  char: string;
  count: number;
}

interface SpacingCandidates {
  left: CharacterFrequency[];
  right: CharacterFrequency[];
}

interface KerningScope {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  punctuation: boolean;
  accented: boolean;
  nonLatin: boolean;
}

/**
 * Extract kerning pairs using OpenType.js built-in methods
 */
const extractKerningPairs = (font: Font): Record<string, number> => {
  // Check if the font has the required methods
  if (!font || typeof font.getKerningValue !== 'function' || typeof font.charToGlyph !== 'function') {
    console.error('Font missing required methods for kerning extraction');
    return {};
  }

  const kerningPairs: Record<string, number> = {};
  
  // Use a comprehensive character set
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?"\'()[]{}<>/-_';
  
  // Try all possible pairs
  for (let i = 0; i < characters.length; i++) {
    for (let j = 0; j < characters.length; j++) {
      const leftChar = characters[i];
      const rightChar = characters[j];
      
      try {
        // Convert characters to glyphs
        const leftGlyph = font.charToGlyph(leftChar);
        const rightGlyph = font.charToGlyph(rightChar);
        
        // Get kerning value
        const kerningValue = font.getKerningValue(leftGlyph, rightGlyph);
        
        // Only record non-zero values
        if (kerningValue !== 0) {
          kerningPairs[`${leftChar},${rightChar}`] = kerningValue;
        }
      } catch (e) {
        const error = e as Error;
        console.warn(`Error getting kerning for ${leftChar},${rightChar}: ${error.message}`);
      }
    }
  }
  
  console.log(`Extracted ${Object.keys(kerningPairs).length} kerning pairs using built-in methods`);
  return kerningPairs;
};

/**
 * Load font and extract kerning using built-in methods
 * Only extracts explicit kerning from font tables - no synthetic or estimated values
 */
async function loadFontAndExtractKerning(file: File): Promise<FontData> {
  const arrayBuffer = await file.arrayBuffer();
  const font = opentype.parse(arrayBuffer);
  
  // Extract ONLY explicit kerning pairs from the font
  let kerningPairs: Record<string, number> = {};
  
  // Use the extraction method that relies solely on the font's kerning tables
  if (font) {
    kerningPairs = extractKerningPairs(font);
  }
  
  // Get basic font info
  const format = file.name.toLowerCase().endsWith('.otf') ? 'opentype' : 
                file.name.toLowerCase().endsWith('.woff') ? 'woff' :
                file.name.toLowerCase().endsWith('.woff2') ? 'woff2' : 'truetype';
                
  const glyphCount = font.glyphs?.length || 0;
  const unitsPerEm = font.unitsPerEm || 1000;
  
  // Create object URL for font preview
  const url = URL.createObjectURL(file);
  
  // Return the font data with only explicit kerning pairs
  return {
    font,
    kerningPairs,
    glyphCount,
    unitsPerEm,
    format,
    url,
    name: '',  // Will be set later
    fileName: file.name
  };
}
  
/**
 * Convert glyph names or IDs to Unicode characters where possible
 */
const getReadableKerningPairs = (font: Font, kerningPairs: Record<string, number>): Record<string, number> => {
  const readablePairs: Record<string, number> = {};
  
  for (const [pairKey, value] of Object.entries(kerningPairs)) {
    const [left, right] = pairKey.split(',');
    
    // Convert left glyph to character
    let leftChar = left;
    if (font.nameToGlyph && font.nameToGlyph(left)) {
      const glyph = font.nameToGlyph(left);
      leftChar = glyph?.unicode ? String.fromCharCode(glyph.unicode) : left;
    }
    
    // Convert right glyph to character
    let rightChar = right;
    if (font.nameToGlyph && font.nameToGlyph(right)) {
      const glyph = font.nameToGlyph(right);
      rightChar = glyph?.unicode ? String.fromCharCode(glyph.unicode) : right;
    }
    
    const readablePairKey = `${leftChar},${rightChar}`;
    readablePairs[readablePairKey] = value;
  }
  
  return readablePairs;
};

/**
 * Detects font format based on tables
 */
const detectFontFormat = (font: Font): string => {
  if (!font || !font.tables) return 'Unknown';
  
  if (font.tables.CFF) {
    return 'OpenType/CFF';
  } else if (font.tables.glyf) {
    return 'TrueType';
  } else if (font.tables.COLR) {
    return 'Color OpenType';
  } else {
    return 'OpenType';
  }
};

// 4. INTEGRATION WITH THE FONT UPLOADER COMPONENT

interface FontState {
  data: Font;
  name: string;
  fileName: string;
  url: string;
  kerningPairs: Record<string, number>;
  glyphCount: number;
  unitsPerEm: number;
  format: string;
}

interface UploadHandlerOptions {
  setIsLoading: (loading: boolean) => void;
  setFileName: (name: string) => void;
  setFont: (font: FontState) => void;
  setError: (error: string) => void;
  fontName?: string;
  defaultName: string;
}

const handleFileChange = async (
  e: React.ChangeEvent<HTMLInputElement>, 
  options: UploadHandlerOptions
) => {
  const { setIsLoading, setFileName, setFont, setError, fontName, defaultName } = options;
  
  const file = e.target.files?.[0];
  if (!file) return;
  
  setIsLoading(true);
  setFileName(file.name);
  
  try {
    const fontData = await loadFontAndExtractKerning(file);
    
    setFont({
      data: fontData.font,
      name: fontName || defaultName,
      fileName: file.name,
      url: fontData.url,
      kerningPairs: fontData.kerningPairs,
      glyphCount: fontData.glyphCount,
      unitsPerEm: fontData.unitsPerEm,
      format: fontData.format
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error loading font:', err);
    setError(`Error loading font: ${err.message}`);
  } finally {
    setIsLoading(false);
  }
};

// 5. ADDITIONAL FONT ANALYSIS FUNCTIONS

/**
 * Analyzes potential spacing candidates based on kerning frequency
 */
const analyzePotentialSpacingCandidates = (kerningPairs: Record<string, number>): SpacingCandidates => {
  // Characters that should probably use spacing instead of kerning
  const leftCharFrequency: Record<string, number> = {};
  const rightCharFrequency: Record<string, number> = {};
  
  // Count frequency of characters in kerning pairs
  Object.keys(kerningPairs).forEach(pairKey => {
    const [left, right] = pairKey.split(',');
    
    leftCharFrequency[left] = (leftCharFrequency[left] || 0) + 1;
    rightCharFrequency[right] = (rightCharFrequency[right] || 0) + 1;
  });
  
  // Define a threshold for "too many" kerning pairs
  const highFrequencyThreshold = Object.keys(kerningPairs).length * 0.05; // 5% of total
  
  // Find characters that appear too frequently
  const highFrequencyLeft = Object.entries(leftCharFrequency)
    .filter(([_, count]) => count >= highFrequencyThreshold)
    .map(([char, count]) => ({ char, count }))
    .sort((a, b) => b.count - a.count);
    
  const highFrequencyRight = Object.entries(rightCharFrequency)
    .filter(([_, count]) => count >= highFrequencyThreshold)
    .map(([char, count]) => ({ char, count }))
    .sort((a, b) => b.count - a.count);
  
  return {
    left: highFrequencyLeft,
    right: highFrequencyRight
  };
};

/**
 * Determines the scope of kerning (which character sets are covered)
 */
const analyzeKerningScope = (kerningPairs: Record<string, number>): KerningScope => {
  // Initialize character set flags
  const charSets: KerningScope = {
    uppercase: false,
    lowercase: false,
    numbers: false,
    punctuation: false,
    accented: false,
    nonLatin: false
  };
  
  // Regex patterns for different character sets
  const patterns: Record<keyof KerningScope, RegExp> = {
    uppercase: /^[A-Z]$/,
    lowercase: /^[a-z]$/,
    numbers: /^[0-9]$/,
    punctuation: /^[.,;:!?""''()\[\]{}<>\/\\|@#$%^&*_+=-]$/,
    // Simple check for accented chars (incomplete)
    accented: /^[À-ÿ]$/,
    // Simple check for non-Latin (very incomplete)
    nonLatin: /[^\x00-\x7F]/
  };
  
  // Check all characters in kerning pairs
  Object.keys(kerningPairs).forEach(pairKey => {
    const [left, right] = pairKey.split(',');
    
    // Check each character against patterns
    [left, right].forEach(char => {
      for (const [setName, pattern] of Object.entries(patterns)) {
        if (pattern.test(char)) {
          // Using type assertion here because we know the keys match
          charSets[setName as keyof KerningScope] = true;
        }
      }
    });
  });
  
  return charSets;
};

export {
  extractKerningPairs,
  analyzePotentialSpacingCandidates,
  analyzeKerningScope,
  handleFileChange,
  getReadableKerningPairs,
  detectFontFormat,
  type Font,
  type FontData,
  type SpacingCandidates,
  type KerningScope,
  type FontState,
  type UploadHandlerOptions
};

// Export the loadFontAndExtractKerning function separately
export { loadFontAndExtractKerning };
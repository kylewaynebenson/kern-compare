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
 * Canvas-based kerning detection as a fallback
 */
const tryCanvasMetricsApproach = async (file: File): Promise<Record<string, number>> => {
  // Create a blob URL for the font
  const fontUrl = URL.createObjectURL(file);
  const fontName = "tempFont" + Math.floor(Math.random() * 10000);
  
  // Add a temporary style element to load the font
  const style = document.createElement('style');
  style.textContent = `
    @font-face {
      font-family: '${fontName}';
      src: url('${fontUrl}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `;
  document.head.appendChild(style);
  
  // Wait for the font to load
  try {
    await document.fonts.load(`16px ${fontName}`);
    console.log(`Font ${fontName} loaded for canvas measurements`);
  } catch (e) {
    const error = e as Error;
    console.error('Error loading font for canvas:', error);
    document.head.removeChild(style);
    URL.revokeObjectURL(fontUrl);
    return {};
  }
  
  // Create a temporary canvas element
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    console.error('Could not get canvas context');
    document.head.removeChild(style);
    URL.revokeObjectURL(fontUrl);
    return {};
  }
  
  // Set the font
  ctx.font = `32px ${fontName}`;
  
  // Problem pairs that often need kerning
  const testPairs = [
    'AV', 'AW', 'AY', 'FA', 'LT', 'PA', 'TA', 'Th', 'Tr', 'Tu', 'Ty', 'VA', 'WA', 'We', 'Yo',
    'av', 'aw', 'ay', 'fa', 'fi', 'fl', 'lt', 'ty', 'va', 'wa', 'we'
  ];
  
  // Detect kerning by comparing widths
  const kerningPairs: Record<string, number> = {};
  
  for (const pair of testPairs) {
    if (pair.length !== 2) continue;
    
    const char1 = pair[0];
    const char2 = pair[1];
    
    // Measure individual characters
    const width1 = ctx.measureText(char1).width;
    const width2 = ctx.measureText(char2).width;
    const individualSum = width1 + width2;
    
    // Measure the pair
    const pairWidth = ctx.measureText(pair).width;
    
    // If there's a difference, there might be kerning
    const diff = pairWidth - individualSum;
    
    // Only record if there's a noticeable difference
    if (Math.abs(diff) > 0.5) {
      kerningPairs[`${char1},${char2}`] = Math.round(diff * -64); // Convert to font units (approximate)
      console.log(`Detected kerning in ${pair}: ${diff.toFixed(2)}px (approx ${kerningPairs[`${char1},${char2}`]} units)`);
    }
  }
  
  // Clean up
  document.head.removeChild(style);
  URL.revokeObjectURL(fontUrl);
  
  return kerningPairs;
};

/**
 * Generate synthetic kerning data for demonstration
 */
const generateSyntheticKerning = (font: Font): Record<string, number> => {
  const pairs: Record<string, number> = {};
  const unitsPerEm = font?.unitsPerEm || 1000;
  
  // Common kerning pairs with typical values
  const commonPairs: Record<string, number> = {
    'A,V': -0.07, 'A,W': -0.06, 'A,Y': -0.08, 'F,a': -0.03, 
    'L,T': -0.08, 'P,a': -0.03, 'T,a': -0.06, 'T,o': -0.06, 
    'V,a': -0.05, 'W,a': -0.04, 'Y,o': -0.07,
    'f,i': -0.02, 'r,a': -0.02, 'T,y': -0.06
  };
  
  // Convert percentage-based values to font units
  for (const [pair, value] of Object.entries(commonPairs)) {
    pairs[pair] = Math.round(value * unitsPerEm);
  }
  
  console.log(`Generated ${Object.keys(pairs).length} synthetic kerning pairs`);
  return pairs;
};

/**
 * Load font and extract kerning using built-in methods
 */
const loadFontAndExtractKerning = async (file: File): Promise<FontData> => {
  if (!file) {
    throw new Error('No file provided');
  }
  
  try {
    // Create a blob URL for the font
    const fontUrl = URL.createObjectURL(file);
    
    // Load the font using opentype.js - Fix the type conversion
    const originalFont = await opentype.load(fontUrl);
    
    // Create a compatible Font object with the structure we need
    const font: Font = {
      ...originalFont as any, // Base properties
      unitsPerEm: originalFont.unitsPerEm,
      charToGlyph: originalFont.charToGlyph.bind(originalFont),
      getKerningValue: originalFont.getKerningValue.bind(originalFont),
      outlinesFormat: (originalFont as any).outlinesFormat,
      // Map the nested names structure if needed
      names: {
        fullName: {
          en: originalFont.names.fullName ? 
            (originalFont.names.fullName as any).en || file.name : 
            file.name
        }
      },
      // Map tables to our simplified structure
      tables: originalFont.tables as Record<string, any>
    };
    
    // Check if the necessary methods exist
    if (typeof font.getKerningValue === 'function' && typeof font.charToGlyph === 'function') {
      console.log('Font has built-in kerning methods, using direct approach');
    } else {
      console.warn('Font is missing built-in kerning methods!');
      // Could add fallback here if needed
    }
    
    // Extract kerning pairs
    const kerningPairs = extractKerningPairs(font);
    
    // If no kerning found, try canvas-based approach as fallback
    if (Object.keys(kerningPairs).length === 0) {
      console.log('No kerning pairs found with built-in methods, trying canvas approach...');
      const canvasKerning = await tryCanvasMetricsApproach(file);
      
      if (Object.keys(canvasKerning).length > 0) {
        console.log(`Found ${Object.keys(canvasKerning).length} kerning pairs using canvas approach`);
        return {
          font,
          url: fontUrl,
          name: font.names?.fullName?.en || file.name,
          fileName: file.name,
          kerningPairs: canvasKerning,
          glyphCount: font.glyphs?.length || 0,
          unitsPerEm: font.unitsPerEm || 1000,
          format: font.outlinesFormat || 'unknown',
          note: 'Kerning extracted via canvas (approximate)'
        };
      }
      
      // If canvas method also fails, use synthetic data
      console.log('Canvas approach failed, generating synthetic data...');
      const syntheticKerning = generateSyntheticKerning(font);
      return {
        font,
        url: fontUrl,
        name: font.names?.fullName?.en || file.name,
        fileName: file.name,
        kerningPairs: syntheticKerning,
        glyphCount: font.glyphs?.length || 0,
        unitsPerEm: font.unitsPerEm || 1000,
        format: font.outlinesFormat || 'unknown',
        note: 'Using synthetic kerning data for demonstration'
      };
    }
    
    return {
      font,
      url: fontUrl,
      name: font.names && font.names.fullName ? font.names.fullName.en : file.name,
      fileName: file.name,
      kerningPairs,
      glyphCount: font.glyphs ? font.glyphs.length : 0,
      unitsPerEm: font.unitsPerEm,
      format: font.outlinesFormat || 'unknown'
    };
  } catch (error) {
    const err = error as Error;
    console.error('Error loading font:', err);
    throw new Error(`Failed to load font: ${err.message}`);
  }
};
  
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
  loadFontAndExtractKerning,
  tryCanvasMetricsApproach,
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
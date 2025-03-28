// Note: this file defines various character sets, dictionaries, which contains different scopes of characters to examine.

// Dictionary options for dropdown
export const DICTIONARY_OPTIONS = {
    'latin-normal': 'Latin Normal',
    'latin-concise': 'Latin Concise', 
    'latin-expansive': 'Latin Expansive',
    'latin-punctuation': 'Latin + Punctuation',
    'numbers': 'Numbers',
    'custom': 'Custom'
  };
  
  // Latin character sets of varying sizes
  const CHARACTERS = {
    // Basic Latin uppercase
    latinUppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    
    // Basic Latin lowercase
    latinLowercase: 'abcdefghijklmnopqrstuvwxyz',
    
    // Digits
    numbers: '0123456789',
    
    // Basic punctuation
    basicPunctuation: '.,;:!?"\'()[]{}<>/-_',
    
    // Extended punctuation
    extendedPunctuation: '.,;:!?"\'()[]{}<>/-_@#$%^&*+=\\|~`',
    
    // Common accented characters
    latinAccented: 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ',
    
    // Special characters commonly used in typography
    specialChars: '§©®™°†‡•'
  };
  
  // Problem pairs that often need kerning attention
  const PROBLEM_PAIRS = [
    // Common kerning problem pairs
    'AV', 'AW', 'AY', 'FA', 'LT', 'PA', 'TA', 'Th', 'Tr', 'Tu', 'Ty', 'VA', 'WA', 'We', 'Yo',
    'av', 'aw', 'ay', 'fa', 'fi', 'fl', 'lt', 'ty', 'va', 'wa', 'we',
    'To', 'Ta', 'Te', 'Wa',
    
    // Number pairs that often need attention
    '17', '10', '71'
  ];
  
  // Dictionary definitions with different character scopes
  const DICTIONARIES = {
    // Concise set - focused on the most common characters and problem pairs
    'latin-concise': {
      characters: CHARACTERS.latinUppercase + 
                  CHARACTERS.latinLowercase + 
                  CHARACTERS.numbers + 
                  CHARACTERS.basicPunctuation,
      problemPairs: PROBLEM_PAIRS,
      description: 'Basic Latin characters with common punctuation. Focuses on the most essential kerning pairs.'
    },
    
    // Normal set - standard Latin character set
    'latin-normal': {
      characters: CHARACTERS.latinUppercase + 
                  CHARACTERS.latinLowercase + 
                  CHARACTERS.numbers + 
                  CHARACTERS.basicPunctuation + 
                  CHARACTERS.latinAccented,
      problemPairs: PROBLEM_PAIRS,
      description: 'Standard Latin characters including accented characters and basic punctuation.'
    },
    
    // Expansive set - comprehensive character coverage
    'latin-expansive': {
      characters: CHARACTERS.latinUppercase + 
                  CHARACTERS.latinLowercase + 
                  CHARACTERS.numbers + 
                  CHARACTERS.extendedPunctuation + 
                  CHARACTERS.latinAccented + 
                  CHARACTERS.specialChars,
      problemPairs: PROBLEM_PAIRS,
      description: 'Comprehensive Latin character set with extended punctuation and special typographic characters.'
    },
    
    // Specialized dictionaries for specific use cases
    'latin-punctuation': {
      characters: CHARACTERS.latinUppercase + 
                  CHARACTERS.latinLowercase + 
                  CHARACTERS.extendedPunctuation,
      problemPairs: [],
      description: 'Focuses on kerning between letters and punctuation marks.'
    },
    
    'numbers': {
      characters: CHARACTERS.numbers + '.,-%$€£¥',
      problemPairs: ['10', '11', '17', '70', '71', '00', '-1', '.0', ',0', '7.', '7,'],
      description: 'Focuses on numerals and monetary symbols.'
    },
    
    // Default placeholder for custom dictionaries
    'custom': {
      characters: '',
      problemPairs: [],
      description: 'Custom character set defined by the user.'
    }
  };
  
  /**
   * Get a dictionary by its ID
   * @param {string} dictionaryId - The ID of the dictionary to retrieve
   * @returns {Object} The dictionary object
   */
  export const getDictionary = (dictionaryId) => {
    return DICTIONARIES[dictionaryId] || DICTIONARIES['latin-normal'];
  };
  
  /**
   * Generate all possible kerning pairs from a set of characters
   * @param {string} characters - String of characters to generate pairs from
   * @returns {Array} Array of all possible kerning pairs
   */
  export const generateAllPairs = (characters) => {
    const pairs = [];
    
    for (let i = 0; i < characters.length; i++) {
      for (let j = 0; j < characters.length; j++) {
        const left = characters[i];
        const right = characters[j];
        pairs.push(`${left}${right}`);
      }
    }
    
    return pairs;
  };
  
  /**
   * Generate a curated set of kerning pairs for analysis
   * Based on most common combinations and known problem pairs
   * @param {string} dictionaryId - Dictionary ID to use
   * @param {number} maxPairs - Maximum number of pairs to generate
   * @returns {Array} Array of kerning pairs
   */
  export const generateKerningPairs = (dictionaryId, maxPairs = 200) => {
    const dictionary = getDictionary(dictionaryId);
    const chars = dictionary.characters;
    
    // Start with the problem pairs
    let pairs = [...dictionary.problemPairs];
    
    // Add vowel combinations (which often need kerning attention)
    const vowels = 'AEIOUaeiou';
    for (let i = 0; i < vowels.length; i++) {
      for (let j = 0; j < vowels.length; j++) {
        pairs.push(`${vowels[i]}${vowels[j]}`);
      }
    }
    
    // Add uppercase/uppercase combinations (particularly with diagonal letters)
    const diagonals = 'AVWXY';
    for (const d of diagonals) {
      for (const c of CHARACTERS.latinUppercase) {
        pairs.push(`${d}${c}`);
        pairs.push(`${c}${d}`);
      }
    }
    
    // Add some lowercase following uppercase (common in sentence starts)
    for (const upper of CHARACTERS.latinUppercase) {
      for (const lower of 'aeioutrn') {
        pairs.push(`${upper}${lower}`);
      }
    }
    
    // Add some punctuation combinations
    const importantChars = CHARACTERS.latinUppercase + 'aeioutrndm';
    for (const c of importantChars) {
      for (const p of '.,:;-"\'') {
        pairs.push(`${c}${p}`);
        pairs.push(`${p}${c}`);
      }
    }
    
    // Remove duplicates
    pairs = Array.from(new Set(pairs));
    
    // Limit to max pairs
    return pairs.slice(0, maxPairs);
  };
  
  /**
   * Filter kerning pairs based on a particular dictionary
   * @param {Object} kerningPairs - Object containing kerning pairs
   * @param {string} dictionaryId - Dictionary ID to use for filtering
   * @returns {Object} Filtered kerning pairs
   */
  export const filterPairsByDictionary = (kerningPairs, dictionaryId) => {
    const dictionary = getDictionary(dictionaryId);
    const charSet = new Set(dictionary.characters.split(''));
    
    // If it's an empty set or 'custom', return all pairs
    if (charSet.size === 0 || dictionaryId === 'custom') {
      return kerningPairs;
    }
    
    // Filter to only pairs where both characters are in the dictionary
    const filteredPairs = {};
    
    for (const [pairKey, value] of Object.entries(kerningPairs)) {
      const [left, right] = pairKey.split(',');
      
      if (charSet.has(left) && charSet.has(right)) {
        filteredPairs[pairKey] = value;
      }
    }
    
    return filteredPairs;
  };
  
  /**
   * Get recommended pair samples for a specific dictionary
   * Returns a curated list of sample pairs that best demonstrate
   * kerning issues for the selected dictionary
   */
  export const getRecommendedPairs = (dictionaryId) => {
    const dictionary = getDictionary(dictionaryId);
    
    // Return problem pairs with a few extras depending on the dictionary
    switch (dictionaryId) {
      case 'latin-concise':
        return PROBLEM_PAIRS.slice(0, 15);
        
      case 'numbers':
        return ['10', '11', '17', '70', '71', '00', '-1', '.0', ',0', '7.', '7,', '$1', '€2', '£3'];
        
      case 'latin-punctuation':
        return ['A.', 'A,', 'A;', 'T.', 'V.', 'F.', 'P.', '.A', ',A', '"A', 'A"', '(A', 'A)', 'A-', '-A'];
        
      default:
        return PROBLEM_PAIRS;
    }
  };
  
  export default DICTIONARIES;
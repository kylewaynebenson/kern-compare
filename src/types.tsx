// Define your types here

export interface FontData {
    data: any; // You can make this more specific if you know the structure
    name: string;
    fileName: string;
    url: string;
    kerningPairs: Record<string, number>;
    kerningCount: number;
    glyphCount: number;
    unitsPerEm: number;
    format: string;
  }
  
  export interface ComparisonItem {
    left: string;
    right: string;
    pair: string;
    beforeValue: number | null;
    afterValue: number | null;
    difference: number;
    status: 'match' | 'different' | 'only-before' | 'only-after';
  }
  
  export interface KerningComparison {
    comparisons: ComparisonItem[];
    stats: {
      totalPairs: number;
      matchCount: number;
      differenceCount: number;
      onlyInBeforeCount: number;
      onlyInAfterCount: number;
      beforeTotal: number;
      afterTotal: number;
    };
    spacingCandidates: {
      left: { char: string; count: number }[];
      right: { char: string; count: number }[];
    };
    kerningScope: {
      before: {
        uppercase: boolean;
        lowercase: boolean;
        numbers: boolean;
        punctuation: boolean;
        accented: boolean;
        nonLatin: boolean;
      };
      after: {
        uppercase: boolean;
        lowercase: boolean;
        numbers: boolean;
        punctuation: boolean;
        accented: boolean;
        nonLatin: boolean;
      };
    };
  }
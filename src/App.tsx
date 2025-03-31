import { useState, useEffect, ChangeEvent } from 'react';
import { 
  Check, AlertTriangle, UploadCloud, 
  Type as Search, Info,
  PlusCircleIcon,
  MinusCircleIcon
} from 'lucide-react';
import type { FontData, KerningComparison } from './types';
import { loadFontAndExtractKerning, analyzePotentialSpacingCandidates, analyzeKerningScope } from './utils/fontUtils';
import { DICTIONARY_OPTIONS, getDictionary, filterPairsByDictionary } from './utils/dictionaries';

interface FontUploaderProps {
  defaultName: string;
  setFont: (font: FontData | null) => void;
  setFontUrl: (url: string | null) => void;
  updateFontName?: (name: string) => void;
}

interface ComparisonItem {
  left: string;
  right: string;
  pair: string;
  beforeValue: number | null;
  afterValue: number | null;
  difference: number;
  status: 'match' | 'different' | 'only-before' | 'only-after';
}

interface KerningPair {
  pair: string;
  value: number;
}

interface AsymmetricPair {
  pair: string;
  reversePair: string;
  value: number;
  reverseValue: number;
  difference: number;
}

interface PatternGroup {
  left: string;
  pairs: Array<{
    pair: string;
    right: string;
    value: number;
  }>;
  variance: number;
  mean: number;
}

// Font Uploader Component
const FontUploader = ({ defaultName, setFont, setFontUrl, updateFontName }: FontUploaderProps) => {
  const [fontName, setFontName] = useState(defaultName);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [userModifiedName, setUserModifiedName] = useState(false);
  
  // Track when user modifies the name manually
  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setFontName(newName);
    setUserModifiedName(true);
    
    // Call the updateFontName prop to update name in parent component
    if (updateFontName) {
      updateFontName(newName);
    }
  };
  
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    setFileName(file.name);
    setProgress('Loading font...');
    
    try {
      // Load font and extract kerning information
      const fontData = await loadFontAndExtractKerning(file);
      setProgress('Extracting kerning data...');
      
      // Calculate some statistics
      const kerningCount = Object.keys(fontData.kerningPairs).length;
      
      // Try to get font name from the file metadata
      let detectedName = '';
      
      // Try to extract name from font metadata
      if (fontData.font.names?.fullName?.en) {
        detectedName = fontData.font.names.fullName.en;
      } else if (file.name) {
        // Use file name without extension as fallback
        detectedName = file.name.replace(/\.(ttf|otf|woff|woff2)$/i, '');
      }
      
      // Only update the name if user hasn't modified it manually
      let nameToUse = fontName;
      if (!userModifiedName && detectedName) {
        setFontName(detectedName);
        nameToUse = detectedName;
        
        // Call updateFontName when auto-detecting
        if (updateFontName) {
          updateFontName(detectedName);
        }
      }
      
      // Set font data with the name we've determined
      setFont({
        data: fontData.font,
        name: nameToUse, // Use either user's custom name or detected name
        fileName: file.name,
        url: fontData.url,
        kerningPairs: fontData.kerningPairs,
        kerningCount,
        glyphCount: fontData.glyphCount,
        unitsPerEm: fontData.unitsPerEm,
        format: fontData.format
      });
      
      // Set font URL for CSS
      setFontUrl(fontData.url);
      
      setProgress(null);
    } catch (error) {
      console.error('Error loading font:', error);
      setProgress(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Clear after 3 seconds
      setTimeout(() => {
        setProgress(null);
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium">Upload Font File</label>
        <div className="border border-dashed rounded-md p-4 bg-gray-50 flex items-center">
          <UploadCloud className="h-6 w-6 text-gray-400 mr-2 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {fileName ? (
              <p className="text-sm text-gray-700 truncate" title={fileName}>{fileName}</p>
            ) : (
              <p className="text-sm text-gray-500">{progress || "Select or drop a font file"}</p>
            )}
          </div>
          <input
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            onChange={handleFileChange}
            className="hidden"
            id={`font-file-${defaultName}`}
          />
          <button 
            className={`ml-2 px-3 py-1 text-xs border rounded-md ${
              isLoading ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50 text-gray-700'
            }`}
            onClick={() => document.getElementById(`font-file-${defaultName}`)?.click()}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Select Font'}
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Font Name</label>
        <input 
          type="text"
          className="w-full px-3 py-2 border rounded-md"
          value={fontName} 
          onChange={handleNameChange}
          placeholder={`Auto-detect from font file`}
        />
        {userModifiedName && <p className="text-xs text-gray-500">Custom name will be used instead of auto-detected name</p>}
      </div>
      
      {/* Add font preview here */}
      {fileName && (
          <div 
            style={{ 
              fontFamily: defaultName === 'First' ? 'FirstFontPreview' : 'SecondFontPreview', 
              fontSize: '36px', 
              lineHeight: 1.2,
              textRendering: 'optimizeLegibility'
            }}
            className="min-h-10 p-2 border rounded-md bg-gray-50"
          >
            AaBbCc
          </div>
      )}
    </div>
  );
};

// Main application component
const KerningComparison = () => {
  const [fontFirst, setFontFirst] = useState<FontData | null>(null);
  const [fontSecond, setFontSecond] = useState<FontData | null>(null);
  const [discrepancyUnits, setDiscrepancyUnits] = useState(5);
  const [dictionary, setDictionary] = useState('latin-normal');
  const [customDictionary, setCustomDictionary] = useState('');
  const [comparisonResults, setComparisonResults] = useState<KerningComparison | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showOnlyDifferences] = useState(false);
  const [fontFirstUrl, setFontFirstUrl] = useState<string | null>(null);
  const [fontSecondUrl, setFontSecondUrl] = useState<string | null>(null);
  const [showDictionaryInfo, setShowDictionaryInfo] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewSize, setPreviewSize] = useState(36); // For side-by-side comparison view
  const [overlaySize, setOverlaySize] = useState(300); // For overlay view

  // Add these functions to update the font names
  const updateFirstFontName = (name: string) => {
    if (fontFirst) {
      setFontFirst({
        ...fontFirst,
        name: name
      });
    }
  };
  
  const updateSecondFontName = (name: string) => {
    if (fontSecond) {
      setFontSecond({
        ...fontSecond, 
        name: name
      });
    }
  };

  // Add this new state variable at the beginning of your KerningComparison component
  const [activeTab, setActiveTab] = useState('settings'); // Options: 'settings', 'analysis', 'comparison'

  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [showOutlierInfo, setShowOutlierInfo] = useState(false);
  const [showSymmetryInfo, setShowSymmetryInfo] = useState(false);
  const [showPatternInfo, setShowPatternInfo] = useState(false);
  const [showSpacingInfo, setShowSpacingInfo] = useState(false);


  // Update custom dictionary when it changes
  useEffect(() => {
    if (dictionary === 'custom') {
      // Update the custom dictionary in the module
      const dictionaries = getDictionary('custom');
      dictionaries.characters = customDictionary;
    }
  }, [dictionary, customDictionary]);

  // Compare the kerning tables
  const compareKerningTables = () => {
    if (!fontFirst || !fontSecond) {
      setError('Please upload both fonts to compare');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Get kerning pairs from both fonts
      const firstPairs = fontFirst.kerningPairs || {};
      const secondPairs = fontSecond.kerningPairs || {};
      
      console.log('First kerning pairs:', Object.keys(firstPairs).length);
      console.log('Second kerning pairs:', Object.keys(secondPairs).length);
      
      if (Object.keys(firstPairs).length === 0 && Object.keys(secondPairs).length === 0) {
        setError('No kerning pairs found in either font. Try a different font file or check font format support.');
        setIsAnalyzing(false);
        return;
      }
      
      // Filter pairs based on selected dictionary
      const filteredFirstPairs = filterPairsByDictionary(firstPairs, dictionary);
      const filteredSecondPairs = filterPairsByDictionary(secondPairs, dictionary);
      
      console.log('Filtered first pairs:', Object.keys(filteredFirstPairs).length);
      console.log('Filtered second pairs:', Object.keys(filteredSecondPairs).length);
      
      if (Object.keys(filteredFirstPairs).length === 0 && Object.keys(filteredSecondPairs).length === 0) {
        setError(`No kerning pairs found after filtering with the "${DICTIONARY_OPTIONS[dictionary]}" dictionary. Try a different dictionary.`);
        setIsAnalyzing(false);
        return;
      }
      
      // Find all unique pair keys from the filtered pairs
      const allPairKeys = new Set([
        ...Object.keys(filteredFirstPairs),
        ...Object.keys(filteredSecondPairs)
      ]);
      
      console.log('Total unique pair keys:', allPairKeys.size);
      
      // Compare pairs
      const comparisons: Array<{
        left: string;
        right: string;
        pair: string;
        beforeValue: number | null;
        afterValue: number | null;
        difference: number;
        status: 'match' | 'different' | 'only-before' | 'only-after';
      }> = [];
      let matchCount = 0;
      let differenceCount = 0;
      let onlyInFirstCount = 0;
      let onlyInSecondCount = 0;
      
      allPairKeys.forEach(pairKey => {
        const [left, right] = pairKey.split(',');
        const firstValue = filteredFirstPairs[pairKey];
        const afterValue = filteredSecondPairs[pairKey];
        
        let status: 'match' | 'different' | 'only-before' | 'only-after';
        let difference = 0;
        
        if (firstValue !== undefined && afterValue !== undefined) {
          difference = afterValue - firstValue;
          
          if (Math.abs(difference) <= discrepancyUnits) {
            status = 'match';
            matchCount++;
          } else {
            status = 'different';
            differenceCount++;
          }
        } else if (firstValue !== undefined) {
          status = 'only-before';
          onlyInFirstCount++;
        } else {
          status = 'only-after';
          onlyInSecondCount++;
        }
        
        comparisons.push({
          left,
          right,
          pair: `${left}${right}`, 
          beforeValue: firstValue !== undefined ? firstValue : null,
          afterValue: afterValue !== undefined ? afterValue : null,
          difference,
          status
        });
      });
      
      console.log('Generated comparisons:', comparisons.length);
      console.log('Matches:', matchCount);
      console.log('Differences:', differenceCount);
      console.log('Only in first:', onlyInFirstCount);
      console.log('Only in second:', onlyInSecondCount);
      
      // Sort by status and difference magnitude
      comparisons.sort((a, b) => {
        // First by status priority
        const statusPriority: Record<string, number> = {
          'different': 0,
          'only-before': 1,
          'only-after': 2,
          'match': 3
        };
        
        if (statusPriority[a.status as keyof typeof statusPriority] !== 
            statusPriority[b.status as keyof typeof statusPriority]) {
          return statusPriority[a.status as keyof typeof statusPriority] - 
                 statusPriority[b.status as keyof typeof statusPriority];
        }
        
        // Then by difference magnitude for 'different' status
        if (a.status === 'different' && b.status === 'different') {
          return Math.abs(b.difference) - Math.abs(a.difference);
        }
        
        // Then alphabetically by left character
        return a.left.localeCompare(b.left);
      });
      
      // Analyze potential spacing candidates
      const firstFontSpacingCandidates = analyzePotentialSpacingCandidates(filteredFirstPairs);
      const secondFontSpacingCandidates = analyzePotentialSpacingCandidates(filteredSecondPairs);
      
      // Analyze kerning scope
      const kerningScope = {
        before: analyzeKerningScope(filteredFirstPairs),
        after: analyzeKerningScope(filteredSecondPairs)
      };
      
      setComparisonResults({
        comparisons,
        stats: {
          totalPairs: allPairKeys.size,
          matchCount,
          differenceCount,
          onlyInBeforeCount: onlyInFirstCount,
          onlyInAfterCount: onlyInSecondCount,
          beforeTotal: Object.keys(filteredFirstPairs).length,
          afterTotal: Object.keys(filteredSecondPairs).length
        },
        spacingCandidates: {
          before: firstFontSpacingCandidates,
          after: secondFontSpacingCandidates
        },
        kerningScope
      });
      
    } catch (err: unknown) {
      console.error('Error analyzing fonts:', err);
      setError(`Error analyzing fonts: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filter comparisons based on active filter
  const getFilteredComparisons = () => {
    if (!comparisonResults) {
      console.log('No comparison results available');
      return [];
    }
    
    console.log('Raw comparisons count:', comparisonResults.comparisons.length);
    
    let filtered = [...comparisonResults.comparisons];
    
    // Apply status filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(comp => comp.status === activeFilter);
      console.log(`After '${activeFilter}' filter:`, filtered.length);
    }
    
    // Apply differences only filter
    if (showOnlyDifferences) {
      filtered = filtered.filter(comp => comp.status !== 'match');
      console.log('After differences-only filter:', filtered.length);
    }
    
    return filtered;
  };

  // Add this useEffect to reclassify comparisons when discrepancyUnits changes
  useEffect(() => {
    if (!comparisonResults || !fontFirst || !fontSecond) return;
    
    // Only recalculate when we have results and discrepancyUnits changes
    const rawComparisons = [...comparisonResults.comparisons];
    let matchCount = 0;
    let differenceCount = 0;
    // const onlyInBeforeCount = comparisonResults.stats.onlyInBeforeCount;
    // const onlyInAfterCount = comparisonResults.stats.onlyInAfterCount;
    
    // Reclassify each comparison based on new discrepancyUnits value
    const updatedComparisons = rawComparisons.map(comp => {
      // Only need to reclassify pairs that have values in both fonts
      if (comp.beforeValue !== null && comp.afterValue !== null) {
        const difference = comp.afterValue - comp.beforeValue;
        
        // Check if status needs to change based on new discrepancyUnits
        if (Math.abs(difference) <= discrepancyUnits) {
          if (comp.status !== 'match') {
            comp.status = 'match';
          }
          matchCount++;
        } else {
          if (comp.status !== 'different') {
            comp.status = 'different';
          }
          differenceCount++;
        }
      } else if (comp.beforeValue !== null) {
        // These counts remain unchanged
        comp.status = 'only-before';
      } else {
        comp.status = 'only-after';
      }
      
      return comp;
    });
    
    // Update the comparison results with new classifications
    setComparisonResults({
      ...comparisonResults,
      comparisons: updatedComparisons,
      stats: {
        ...comparisonResults.stats,
        matchCount,
        differenceCount
      }
    });
    
    // Reset active filter when rounding changes to show all results
    // (Optional - remove this if you want to keep the current filter)
    if (activeFilter !== 'all') {
      setActiveFilter('all');
    }
    
  }, [discrepancyUnits]); // Only trigger when discrepancyUnits changes

  // 2. Add this helper function to navigate between pairs
  const navigateToPair = (direction: 'next' | 'prev') => {
    if (!comparisonResults) return;
    
    const filteredPairs = getFilteredComparisons().filter(comp => 
      comp.pair.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (filteredPairs.length === 0) return;
    
    if (direction === 'next') {
      setCurrentPairIndex((prev) => (prev + 1) % filteredPairs.length);
    } else {
      setCurrentPairIndex((prev) => (prev - 1 + filteredPairs.length) % filteredPairs.length);
    }
  };

  // Helper function to get outliers
  const getOutliers = (comparisons: ComparisonItem[], fontKey: 'before' | 'after', type: 'positive' | 'negative'): KerningPair[] => {
    const valueProp = fontKey === 'before' ? 'beforeValue' : 'afterValue';
    const validPairs = comparisons.filter(comp => comp[valueProp] !== null);
    
    if (validPairs.length === 0) return [];
    
    // Get values and calculate basic statistics
    const values = validPairs.map(comp => comp[valueProp] as number);
    const mean = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / values.length
    );
    
    // Get positive or negative outliers
    const threshold = stdDev * 2; // Values more than 2 standard deviations from the mean
    
    let filteredPairs: ComparisonItem[];
    if (type === 'positive') {
      filteredPairs = validPairs.filter(comp => (comp[valueProp] as number) > mean + threshold);
      filteredPairs.sort((a, b) => (b[valueProp] as number) - (a[valueProp] as number)); // Sort descending
    } else {
      filteredPairs = validPairs.filter(comp => (comp[valueProp] as number) < mean - threshold);
      filteredPairs.sort((a, b) => (a[valueProp] as number) - (b[valueProp] as number)); // Sort ascending
    }
    
    // Return top 5 outliers
    return filteredPairs.slice(0, 5).map(comp => ({
      pair: comp.pair,
      value: comp[valueProp] as number
    }));
  };

  // Helper function to find asymmetric pairs
  const getAsymmetricPairs = (comparisons: ComparisonItem[], fontKey: 'before' | 'after'): AsymmetricPair[] => {
    const valueProp = fontKey === 'before' ? 'beforeValue' : 'afterValue';
    const validPairs = comparisons.filter(comp => comp[valueProp] !== null);
    
    if (validPairs.length === 0) return [];
    
    const asymmetries: AsymmetricPair[] = [];
    const pairMap = new Map<string, number>();
    
    // Create a map of all pairs for easy lookup
    validPairs.forEach(comp => {
      pairMap.set(`${comp.left},${comp.right}`, comp[valueProp] as number);
    });
    
    // Check each pair for its reverse
    validPairs.forEach(comp => {
      const reversePairKey = `${comp.right},${comp.left}`;
      if (pairMap.has(reversePairKey)) {
        const value = comp[valueProp] as number;
        const reverseValue = pairMap.get(reversePairKey) as number;
        const difference = Math.abs(value - reverseValue);
        
        // Only include if the difference is significant (more than 10 units)
        if (difference > 10) {
          asymmetries.push({
            pair: comp.pair,
            reversePair: `${comp.right}${comp.left}`,
            value,
            reverseValue,
            difference
          });
        }
      }
    });
    
    // Sort by difference (largest first) and return top 5
    return asymmetries
      .sort((a, b) => b.difference - a.difference)
      .slice(0, 5);
  };

  // Helper function to find inconsistent patterns
  const getInconsistentPatterns = (comparisons: ComparisonItem[], fontKey: 'before' | 'after'): PatternGroup[] => {
    const valueProp = fontKey === 'before' ? 'beforeValue' : 'afterValue';
    const validPairs = comparisons.filter(comp => comp[valueProp] !== null);
    
    if (validPairs.length === 0) return [];
    
    // Group pairs by their left character
    const leftGroups: Record<string, Array<{pair: string; right: string; value: number}>> = {};
    
    validPairs.forEach(comp => {
      if (!leftGroups[comp.left]) {
        leftGroups[comp.left] = [];
      }
      leftGroups[comp.left].push({
        pair: comp.pair,
        right: comp.right,
        value: comp[valueProp] as number
      });
    });
    
    // Calculate variance for each group with at least 3 pairs
    const inconsistentGroups: PatternGroup[] = [];
    
    Object.entries(leftGroups).forEach(([left, pairs]) => {
      if (pairs.length >= 3) {
        const values = pairs.map(p => p.value);
        const mean = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
        const variance = values.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / values.length;
        
        // Only include groups with high variance (indicating inconsistency)
        if (variance > 100) { // Threshold can be adjusted
          inconsistentGroups.push({
            left,
            pairs,
            variance,
            mean
          });
        }
      }
    });
    
    // Sort by variance (highest first) and return top 3
    return inconsistentGroups
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 3);
  };

  // Then modify your return statement to include the tab navigation
  // Fix for the return statement in KerningComparison component
return (
  <>
    <div className="mx-4">
      <div className="mb-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {/* Logo and title on the left */}
          <a className="flex items-center gap-2" href="http://github.com/kylewaynebenson/kern-compare" target="_blank" rel="noopener noreferrer">
            <svg width="35" height="36" viewBox="0 0 306 308" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M279.898 166C277.371 245.444 249.972 308 216.544 308C181.45 308 153 239.052 153 154C153 68.9482 181.45 0 216.544 0C250.112 0 277.601 63.082 279.928 143H237.941C235.852 119.008 227.065 101 216.544 101C204.466 101 194.675 124.729 194.675 154C194.675 183.271 204.466 207 216.544 207C226.919 207 235.606 189.491 237.85 166H279.898Z" fill="#D9D9D9"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M126.898 166C124.371 245.444 96.9718 308 63.5438 308C28.4495 308 0 239.052 0 154C0 68.9482 28.4495 0 63.5438 0C97.112 0 124.601 63.082 126.928 143H84.9412C82.8516 119.008 74.0654 101 63.5438 101C51.4659 101 41.6748 124.729 41.6748 154C41.6748 183.271 51.4659 207 63.5438 207C73.9187 207 82.6063 189.491 84.8499 166H126.898Z" fill="#D9D9D9"/>
              <rect x="127" width="26" height="308" fill="#FE4C25"/>
              <rect x="280" width="26" height="26" fill="#FE4C25"/>
              <rect x="280" y="103" width="26" height="25" fill="#FE4C25"/>
              <rect x="280" y="205" width="26" height="26" fill="#FE4C25"/>
              <rect x="280" y="51" width="26" height="26" fill="#FE4C25"/>
              <rect x="280" y="154" width="26" height="26" fill="#FE4C25"/>
              <rect x="280" y="257" width="26" height="25" fill="#FE4C25"/>
              <rect x="280" y="26" width="26" height="25" fill="#FFC8FE"/>
              <rect x="280" y="128" width="26" height="26" fill="#FFC8FE"/>
              <rect x="280" y="231" width="26" height="26" fill="#FFC8FE"/>
              <rect x="280" y="77" width="26" height="26" fill="#FFC8FE"/>
              <rect x="280" y="180" width="26" height="25" fill="#FFC8FE"/>
              <rect x="280" y="282" width="26" height="26" fill="#FFC8FE"/>
            </svg>
            <h1 className="text-xl font-bold">Kern Compare</h1>
          </a>

          {/* Tabs navigation on the right */}
          <nav className="flex" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              disabled={!comparisonResults}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                !comparisonResults
                  ? 'border-transparent text-gray-300 cursor-not-allowed' 
                  : activeTab === 'analysis'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analysis
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              disabled={!comparisonResults}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                !comparisonResults 
                  ? 'border-transparent text-gray-300 cursor-not-allowed' 
                  : activeTab === 'comparison'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setActiveTab('overlay')}
              disabled={!comparisonResults}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                !comparisonResults 
                  ? 'border-transparent text-gray-300 cursor-not-allowed' 
                  : activeTab === 'overlay'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overlay
            </button>
          </nav>
        </div>
      </div>
        
        {/* Show error messages regardless of active tab */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-start">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <div>
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}
        
        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <div className="bg-white">
            <h2 className="text-lg font-bold mb-3 hidden">Settings</h2>
            {/* Your existing settings content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
              <FontUploader 
                defaultName="First" 
                setFont={setFontFirst} 
                setFontUrl={setFontFirstUrl}
                updateFontName={updateFirstFontName}
              />
              <FontUploader 
                defaultName="Second" 
                setFont={setFontSecond} 
                setFontUrl={setFontSecondUrl}
                updateFontName={updateSecondFontName}
              />
            </div>
            
            {/* Dictionary selection section */}
            <div className="mb-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Dictionary</label>
                  <button 
                    onClick={() => setShowDictionaryInfo(!showDictionaryInfo)}
                    className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
                    aria-label="Dictionary info"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
                
                <select 
                  value={dictionary} 
                  onChange={(e) => setDictionary(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  {Object.entries(DICTIONARY_OPTIONS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                
                <p className="text-sm text-gray-500">
                  {getDictionary(dictionary).description}
                </p>
                
                {dictionary === 'custom' && (
                  <div className="mt-2">
                    <label className="text-sm font-medium">Custom Characters</label>
                    <textarea
                      className="w-full px-3 py-2 border rounded-md mt-1 font-mono"
                      rows={3}
                      value={customDictionary}
                      onChange={(e) => setCustomDictionary(e.target.value)}
                      placeholder="Enter the characters you want to include..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      These characters will be used to filter kerning pairs for comparison.
                    </p>
                  </div>
                )}
                {showDictionaryInfo && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-2">
                    <p className="text-xs text-blue-800 mb-2">
                      Dictionaries define which character sets will be analyzed in the kerning comparison. 
                      This set ({DICTIONARY_OPTIONS[dictionary]}) covers:
                    </p>
                    <div className="font-mono text-sm overflow-x-auto text-blue-800 whitespace-nowrap">
                      {getDictionary(dictionary)?.characters || ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Compare button */}
            <div className="flex items-center justify-between">
              <button 
                onClick={compareKerningTables}
                disabled={!fontFirst || !fontSecond || isAnalyzing}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isAnalyzing ? 'Analyzing...' : 'Compare Kerning Tables'}
              </button>
            </div>
          </div>
        )}
        
        {/* Analysis Tab Content */}
        {activeTab === 'analysis' && comparisonResults && (
          <div className="bg-white">
            <h2 className="text-lg font-bold mb-3 hidden">Analysis</h2>
            <p className="text-gray-500 mb-5 max-w-prose">
              This analysis is the result of comparing the  {fontFirst?.name || 'First'} ({fontFirst?.fileName || 'N/A'}) with {fontSecond?.name || 'Second'} ({fontSecond?.fileName || 'N/A'})
              using the {DICTIONARY_OPTIONS[dictionary]} dictionary
            </p>
            
            {/* Your existing analysis content */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
              <div className="bg-gray-50 rounded-md p-4 text-center">
                <p className="text-sm text-gray-500">Total Pairs</p>
                <p className="text-2xl font-bold">{comparisonResults.stats.totalPairs}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-4 text-center">
                <p className="text-sm text-gray-500">Matches</p>
                <p className="text-2xl font-bold">{comparisonResults.stats.matchCount}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-4 text-center">
                <p className="text-sm text-gray-500">Differences</p>
                <p className="text-2xl font-bold">{comparisonResults.stats.differenceCount}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-4 text-center">
                <p className="text-sm text-gray-500">Only In One Font</p>
                <p className="text-2xl font-bold">
                  {comparisonResults.stats.onlyInBeforeCount + comparisonResults.stats.onlyInAfterCount}
                </p>
              </div>
            </div>
            
            <div className="mb-5">
              <h3 className="text-md font-medium mb-2">Kerning Table Size</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-sm text-gray-500">{fontFirst?.name || 'First'} Pairs</p>
                  <div className="flex gap-2 items-center">
                    <p className="text-lg font-medium">{comparisonResults.stats.beforeTotal}</p>
                    {/* Add kerning data size estimate */}
                    <p className="text-xs font-mono text-gray-500 mt-1">
                      ~{Math.round(comparisonResults.stats.beforeTotal * 6 / 1024 * 10) / 10} KB
                    </p>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {comparisonResults.kerningScope?.before.uppercase && <span className="inline-block px-2 py-1 mr-1 mb-1 bg-blue-50 rounded">Uppercase</span>}
                    {comparisonResults.kerningScope?.before.lowercase && <span className="inline-block px-2 py-1 mr-1 mb-1 bg-blue-50 rounded">Lowercase</span>}
                    {comparisonResults.kerningScope?.before.numbers && <span className="inline-block px-2 py-1 mr-1 mb-1 bg-blue-50 rounded">Numbers</span>}
                    {comparisonResults.kerningScope?.before.punctuation && <span className="inline-block px-2 py-1 mr-1 mb-1 bg-blue-50 rounded">Punctuation</span>}
                    {comparisonResults.kerningScope?.before.accented && <span className="inline-block px-2 py-1 mr-1 mb-1 bg-blue-50 rounded">Accented</span>}
                    {comparisonResults.kerningScope?.before.nonLatin && <span className="inline-block px-2 py-1 mr-1 mb-1 bg-blue-50 rounded">Non-Latin</span>}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-sm text-gray-500">{fontSecond?.name || 'Second'} Pairs</p>
                  <div className="flex gap-2 items-center">
                    <p className="text-lg font-medium">{comparisonResults.stats.afterTotal}</p>
                    {/* Add kerning data size estimate */}
                    <p className="text-xs font-mono text-gray-500 mt-1">
                      ~{Math.round(comparisonResults.stats.afterTotal * 6 / 1024 * 10) / 10} KB
                    </p>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {comparisonResults.kerningScope?.after.uppercase && <span className="inline-block px-2 py-1 mr-1 mb-1 bg-blue-50 rounded">Uppercase</span>}
                    {comparisonResults.kerningScope?.after.lowercase && <span className="inline-block px-2 py-1 mr-1 mb-1 bg-blue-50 rounded">Lowercase</span>}
                    {comparisonResults.kerningScope?.after.numbers && <span className="inline-block px-2 py-1 mr-1 mb-1 bg-blue-50 rounded">Numbers</span>}
                    {comparisonResults.kerningScope?.after.punctuation && <span className="inline-block px-2 py-1 mr-1 mb-1 bg-blue-50 rounded">Punctuation</span>}
                    {comparisonResults.kerningScope?.after.accented && <span className="inline-block px-2 py-1 mr-1 mb-1 bg-blue-50 rounded">Accented</span>}
                    {comparisonResults.kerningScope?.after.nonLatin && <span className="inline-block px-2 py-1 mr-1 mb-1 bg-blue-50 rounded">Non-Latin</span>}
                  </div>
                </div>
              </div>
            </div>
            
            <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-md font-medium">Spacing Candidates</h3>
              <button 
                onClick={() => setShowSpacingInfo(!showSpacingInfo)}
                className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
                aria-label="Spacing candidates info"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>

            {showSpacingInfo && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-sm text-blue-800">
                  Characters that appear in many kerning pairs may be candidates for spacing adjustments instead of individual kerning pairs.
                </p>
              </div>
            )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* First Font */}
                <div className="bg-gray-50 rounded-md p-4">
                  <h4 className="text-sm font-medium mb-3">{fontFirst?.name || 'First Font'}</h4>
                  
                  {comparisonResults.spacingCandidates.before.left.length === 0 && 
                    comparisonResults.spacingCandidates.before.right.length === 0 ? (
                    <p className="text-sm text-gray-500">No spacing candidates identified</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <h5 className="text-xs font-medium mb-2 text-gray-500">Left Characters</h5>
                        <div className="space-y-1">
                          {comparisonResults.spacingCandidates.before.left.map(({char, count}) => (
                            <div key={char} className="flex justify-between p-2 bg-white rounded border border-gray-100">
                              <div className="font-mono text-lg">{char}</div>
                              <div className="text-sm text-gray-500">{count} pairs</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium mb-2 text-gray-500">Right Characters</h5>
                        <div className="space-y-1">
                          {comparisonResults.spacingCandidates.before.right.map(({char, count}) => (
                            <div key={char} className="flex justify-between p-2 bg-white rounded border border-gray-100">
                              <div className="font-mono text-lg">{char}</div>
                              <div className="text-sm text-gray-500">{count} pairs</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
            
                {/* Second Font */}
                <div className="bg-gray-50 rounded-md p-4">
                  <h4 className="text-sm font-medium mb-3">{fontSecond?.name || 'Second Font'}</h4>
                  
                  {comparisonResults.spacingCandidates.after.left.length === 0 && 
                    comparisonResults.spacingCandidates.after.right.length === 0 ? (
                    <p className="text-sm text-gray-500">No spacing candidates identified</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <h5 className="text-xs font-medium mb-2 text-gray-500">Left Characters</h5>
                        <div className="space-y-1">
                          {comparisonResults.spacingCandidates.after.left.map(({char, count}) => (
                            <div key={char} className="flex justify-between p-2 bg-white rounded border border-gray-100">
                              <div className="font-mono text-lg">{char}</div>
                              <div className="text-sm text-gray-500">{count} pairs</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium mb-2 text-gray-500">Right Characters</h5>
                        <div className="space-y-1">
                          {comparisonResults.spacingCandidates.after.right.map(({char, count}) => (
                            <div key={char} className="flex justify-between p-2 bg-white rounded border border-gray-100">
                              <div className="font-mono text-lg">{char}</div>
                              <div className="text-sm text-gray-500">{count} pairs</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Add this section after the Spacing Candidates section in the Analysis tab */}

            <div className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-md font-medium">Kerning Outliers</h3>
                <button 
                  onClick={() => setShowOutlierInfo(!showOutlierInfo)}
                  className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              
              {showOutlierInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    Outliers are kerning pairs with unusually large or small values compared to the font's average. They may indicate inconsistencies or potential errors.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* First Font Outliers */}
                <div className="bg-gray-50 rounded-md p-4">
                  <h4 className="text-sm font-medium mb-3">{fontFirst?.name || 'First Font'} Outliers</h4>
                  
                  <div className="space-y-3">
                    <h5 className="text-xs font-medium text-gray-500">Largest Negative Values</h5>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {getOutliers(comparisonResults.comparisons, 'before', 'negative').map((pair, idx) => (
                        <div key={idx} className="flex justify-between p-2 bg-white rounded border border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="font-mono">{pair.pair}</div>
                            <div 
                              style={{ 
                                fontFamily: 'FirstFontPreview', 
                                fontSize: '18px',
                                textRendering: 'optimizeLegibility'
                              }}
                            >
                              {pair.pair}
                            </div>
                          </div>
                          <div className="text-sm font-mono text-red-500">{pair.value}</div>
                        </div>
                      ))}
                    </div>
                    
                    <h5 className="text-xs font-medium text-gray-500">Largest Positive Values</h5>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {getOutliers(comparisonResults.comparisons, 'before', 'positive').map((pair, idx) => (
                        <div key={idx} className="flex justify-between p-2 bg-white rounded border border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="font-mono">{pair.pair}</div>
                            <div 
                              style={{ 
                                fontFamily: 'FirstFontPreview', 
                                fontSize: '18px',
                                textRendering: 'optimizeLegibility'
                              }}
                            >
                              {pair.pair}
                            </div>
                          </div>
                          <div className="text-sm font-mono text-green-500">+{pair.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Second Font Outliers */}
                <div className="bg-gray-50 rounded-md p-4">
                  <h4 className="text-sm font-medium mb-3">{fontSecond?.name || 'Second Font'} Outliers</h4>
                  
                  <div className="space-y-3">
                    <h5 className="text-xs font-medium text-gray-500">Largest Negative Values</h5>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {getOutliers(comparisonResults.comparisons, 'after', 'negative').map((pair, idx) => (
                        <div key={idx} className="flex justify-between p-2 bg-white rounded border border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="font-mono">{pair.pair}</div>
                            <div 
                              style={{ 
                                fontFamily: 'SecondFontPreview', 
                                fontSize: '18px',
                                textRendering: 'optimizeLegibility'
                              }}
                            >
                              {pair.pair}
                            </div>
                          </div>
                          <div className="text-sm font-mono text-red-500">{pair.value}</div>
                        </div>
                      ))}
                    </div>
                    
                    <h5 className="text-xs font-medium text-gray-500">Largest Positive Values</h5>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {getOutliers(comparisonResults.comparisons, 'after', 'positive').map((pair, idx) => (
                        <div key={idx} className="flex justify-between p-2 bg-white rounded border border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="font-mono">{pair.pair}</div>
                            <div 
                              style={{ 
                                fontFamily: 'SecondFontPreview', 
                                fontSize: '18px',
                                textRendering: 'optimizeLegibility'
                              }}
                            >
                              {pair.pair}
                            </div>
                          </div>
                          <div className="text-sm font-mono text-green-500">+{pair.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-md font-medium">Symmetry Analysis</h3>
                <button 
                  onClick={() => setShowSymmetryInfo(!showSymmetryInfo)}
                  className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              
              {showSymmetryInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    This analysis identifies asymmetries in kerning, where a pair (like "AV") and its reverse ("VA") have significantly different values. Some asymmetry is expected, but large differences may need review.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-md p-4">
                  <h4 className="text-sm font-medium mb-3">{fontFirst?.name || 'First Font'} Asymmetries</h4>
                  
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {getAsymmetricPairs(comparisonResults.comparisons, 'before').map((asymmetry, idx) => (
                      <div key={idx} className="p-2 bg-white rounded border border-gray-100">
                        <div className="flex justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="font-mono">{asymmetry.pair}</div>
                            <div 
                              style={{ 
                                fontFamily: 'FirstFontPreview', 
                                fontSize: '18px',
                                textRendering: 'optimizeLegibility'
                              }}
                            >
                              {asymmetry.pair}
                            </div>
                          </div>
                          <div className="text-sm font-mono">{asymmetry.value}</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="flex items-center gap-2">
                            <div className="font-mono">{asymmetry.reversePair}</div>
                            <div 
                              style={{ 
                                fontFamily: 'FirstFontPreview', 
                                fontSize: '18px',
                                textRendering: 'optimizeLegibility'
                              }}
                            >
                              {asymmetry.reversePair}
                            </div>
                          </div>
                          <div className="text-sm font-mono">{asymmetry.reverseValue}</div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Difference: {Math.abs(asymmetry.value - asymmetry.reverseValue)}</div>
                      </div>
                    ))}
                    
                    {getAsymmetricPairs(comparisonResults.comparisons, 'before').length === 0 && (
                      <p className="text-sm text-gray-500">No significant asymmetries found</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-md p-4">
                  <h4 className="text-sm font-medium mb-3">{fontSecond?.name || 'Second Font'} Asymmetries</h4>
                  
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {getAsymmetricPairs(comparisonResults.comparisons, 'after').map((asymmetry, idx) => (
                      <div key={idx} className="p-2 bg-white rounded border border-gray-100">
                        <div className="flex justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="font-mono">{asymmetry.pair}</div>
                            <div 
                              style={{ 
                                fontFamily: 'SecondFontPreview', 
                                fontSize: '18px',
                                textRendering: 'optimizeLegibility'
                              }}
                            >
                              {asymmetry.pair}
                            </div>
                          </div>
                          <div className="text-sm font-mono">{asymmetry.value}</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="flex items-center gap-2">
                            <div className="font-mono">{asymmetry.reversePair}</div>
                            <div 
                              style={{ 
                                fontFamily: 'SecondFontPreview', 
                                fontSize: '18px',
                                textRendering: 'optimizeLegibility'
                              }}
                            >
                              {asymmetry.reversePair}
                            </div>
                          </div>
                          <div className="text-sm font-mono">{asymmetry.reverseValue}</div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Difference: {Math.abs(asymmetry.value - asymmetry.reverseValue)}</div>
                      </div>
                    ))}
                    
                    {getAsymmetricPairs(comparisonResults.comparisons, 'after').length === 0 && (
                      <p className="text-sm text-gray-500">No significant asymmetries found</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Add this section after the Symmetry Analysis section */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-md font-medium">Pattern Consistency</h3>
                <button 
                  onClick={() => setShowPatternInfo(!showPatternInfo)}
                  className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              
              {showPatternInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    This analysis identifies groups of similar character pairs that should have consistent kerning relationships but don't. For example, "AV", "AW", and "AY" might be expected to have similar kerning values.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-md p-4">
                  <h4 className="text-sm font-medium mb-3">{fontFirst?.name || 'First Font'} Inconsistencies</h4>
                  
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {getInconsistentPatterns(comparisonResults.comparisons, 'before').map((group, idx) => (
                      <div key={idx} className="p-2 bg-white rounded border border-gray-100">
                        <div className="text-xs font-medium mb-1">Group with "{group.left}" on left</div>
                        <div className="grid grid-cols-2 gap-2">
                          {group.pairs.map((pair, pairIdx) => (
                            <div key={pairIdx} className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className="font-mono text-sm">{pair.pair}</div>
                                <div 
                                  style={{ 
                                    fontFamily: 'FirstFontPreview', 
                                    fontSize: '16px',
                                    textRendering: 'optimizeLegibility'
                                  }}
                                >
                                  {pair.pair}
                                </div>
                              </div>
                              <div className="text-sm font-mono">{pair.value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Variance: {group.variance.toFixed(1)} units
                        </div>
                      </div>
                    ))}
                    
                    {getInconsistentPatterns(comparisonResults.comparisons, 'before').length === 0 && (
                      <p className="text-sm text-gray-500">No significant inconsistencies found</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-md p-4">
                  <h4 className="text-sm font-medium mb-3">{fontSecond?.name || 'Second Font'} Inconsistencies</h4>
                  
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {getInconsistentPatterns(comparisonResults.comparisons, 'after').map((group, idx) => (
                      <div key={idx} className="p-2 bg-white rounded border border-gray-100">
                        <div className="text-xs font-medium mb-1">Group with "{group.left}" on left</div>
                        <div className="grid grid-cols-2 gap-2">
                          {group.pairs.map((pair, pairIdx) => (
                            <div key={pairIdx} className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className="font-mono text-sm">{pair.pair}</div>
                                <div 
                                  style={{ 
                                    fontFamily: 'SecondFontPreview', 
                                    fontSize: '16px',
                                    textRendering: 'optimizeLegibility'
                                  }}
                                >
                                  {pair.pair}
                                </div>
                              </div>
                              <div className="text-sm font-mono">{pair.value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Variance: {group.variance.toFixed(1)} units
                        </div>
                      </div>
                    ))}
                    
                    {getInconsistentPatterns(comparisonResults.comparisons, 'after').length === 0 && (
                      <p className="text-sm text-gray-500">No significant inconsistencies found</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Side-by-Side Comparison Tab Content */}
        {activeTab === 'comparison' && comparisonResults && (
          <div className="bg-white">
            <h2 className="text-lg font-bold mb-3 hidden">Side-by-Side Comparison</h2>
            <p className="text-gray-500 mb-5 hidden">
              Visual comparison of kerning pairs between fonts
            </p>
            
            {/* Add font size controls */}
            <div className="flex justify-between items-center mb-5 gap-4">
                          {/* Add pair search filter */}
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Filter kerning pairs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-md"
                />
              </div>
              
              {/* Add discrepancy filter slider */}
              <div className="flex items-center gap-2 max-w-1/3">
                <label className="text-sm font-medium whitespace-nowrap">Round:</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={discrepancyUnits}
                  onChange={(e) => setDiscrepancyUnits(parseInt(e.target.value))}
                  className="w-32 md:w-40"
                />
                <span className="text-sm text-gray-500">{discrepancyUnits}</span>
                <div className="relative group ml-1">
                  <span className="cursor-help text-gray-400">ⓘ</span>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-60 p-2 bg-white border rounded shadow-lg text-sm text-gray-600 hidden group-hover:block z-10">
                    Kerning pairs with a difference within this range will be considered a match
                  </div>
                </div>
              </div>
            </div>
            
            {/* Filter options */}
            <div className="flex flex-wrap justify-between items-center mb-5 gap-3">
              <div>
                <div className="inline-flex rounded-md shadow-sm mb-3" role="group">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                      activeFilter === 'all' 
                      ? 'bg-blue-50 text-blue-700 border-blue-300' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    All ({comparisonResults.comparisons.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('different')}
                    className={`px-4 py-2 text-sm font-medium border-t border-b border-r ${
                      activeFilter === 'different' 
                      ? 'bg-blue-50 text-blue-700 border-blue-300' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Different ({comparisonResults.stats.differenceCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('only-before')}
                    className={`px-4 py-2 text-sm font-medium border-t border-b border-r ${
                      activeFilter === 'only-before' 
                      ? 'bg-blue-50 text-blue-700 border-blue-300' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Only in {fontFirst?.name || 'First Font'} ({comparisonResults.stats.onlyInBeforeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('only-after')}
                    className={`px-4 py-2 text-sm font-medium border-t border-b ${
                      activeFilter === 'only-after' 
                      ? 'bg-blue-50 text-blue-700 border-blue-300' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Only in {fontSecond?.name || 'Second Font'} ({comparisonResults.stats.onlyInAfterCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('match')}
                    className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${
                      activeFilter === 'match' 
                      ? 'bg-blue-50 text-blue-700 border-blue-300' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Matching ({comparisonResults.stats.matchCount})
                  </button>
                </div>
              </div>
            </div>
            
            <div className="border rounded-md overflow-x-auto overflow-y-auto max-h-[calc(90vh-250px)]">
              <table className="min-w-full divide-y divide-gray-200 position-relative">
                <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                  <tr>
                    <th className="flex items-center px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="hidden">Pair</span>
                      <span className="flex items-center gap-1">
                      <button 
                        onClick={() => setPreviewSize(Math.max(12, previewSize - 4))}
                        className="p-1 rounded-md hover:bg-gray-60"
                        aria-label="Decrease size"
                      >
                        <MinusCircleIcon className="h-3 w-3" />
                      </button>
                      <span className="text-xs">{previewSize}px</span>
                      <button 
                        onClick={() => setPreviewSize(Math.min(72, previewSize + 4))}
                        className="p-1 rounded-md hover:bg-gray-70"
                        aria-label="Increase size"
                      >
                        <PlusCircleIcon className="h-3 w-3" />
                      </button>
                    </span>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{fontFirst?.name || 'First'}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{fontSecond?.name || 'Second'}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difference</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredComparisons().filter(comp => 
                    comp.pair.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((comp, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="font-mono">{comp.left},{comp.right}</div>
                          {/* Visual preview of the pair */}
                          <div className="flex space-x-4">
                            <span 
                              style={{ 
                                fontFamily: 'FirstFontPreview', 
                                fontSize: `${previewSize}px`,
                                textRendering: 'optimizeLegibility'
                              }}
                              className="text-gray-700"
                            >
                              {comp.pair}
                            </span>
                            <span 
                              style={{ 
                                fontFamily: 'SecondFontPreview', 
                                fontSize: `${previewSize}px`,
                                textRendering: 'optimizeLegibility'
                              }}
                              className="text-gray-700"
                            >
                              {comp.pair}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {comp.beforeValue !== null ? comp.beforeValue : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {comp.afterValue !== null ? comp.afterValue : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {comp.status === 'different' ? (
                          <span className={comp.difference > 0 ? 'text-green-600' : 'text-red-600'}>
                            {comp.difference > 0 ? '+' : ''}{comp.difference}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {comp.status === 'match' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Check className="h-3 w-3 mr-1" /> Match
                          </span>
                        )}
                        {comp.status === 'different' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Different
                          </span>
                        )}
                        {comp.status === 'only-before' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Only in {fontFirst?.name || 'First Font'}
                          </span>
                        )}
                        {comp.status === 'only-after' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Only in {fontSecond?.name || 'Second Font'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Overlay Tab Content */}
        {activeTab === 'overlay' && comparisonResults && (
          <div className="bg-white">
            <h2 className="text-lg font-bold mb-3 hidden">Kerning Overlay Comparison</h2>
            
            {/* Get the current pair to display */}
            {(() => {
              const filteredPairs = getFilteredComparisons().filter(comp => 
                comp.pair.toLowerCase().includes(searchTerm.toLowerCase())
              );
              
              if (filteredPairs.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-gray-500">No pairs match your current filters.</p>
                    <button
                      onClick={() => {
                        setActiveFilter('all');
                        setSearchTerm('');
                      }}
                      className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                    >
                      Reset filters
                    </button>
                  </div>
                );
              }
              
              // Ensure current index is valid
              if (currentPairIndex >= filteredPairs.length) {
                setCurrentPairIndex(0);
              }
              
              const currentPair = filteredPairs[currentPairIndex];
              
              return (
                <>                  
                  {/* Large overlay display */}
                  <div className="relative border rounded-lg overflow-hidden bg-gray-50 p-10 flex items-center justify-center mb-4 h-[calc(70vh-200px)] min-h-[400px]">
                    {/* Font size control */}
                    <div className="flex items-center gap-2 mb-4 absolute top-4 right-4">
                      <label className="text-sm font-medium hidden">Size:</label>
                      <button 
                        onClick={() => setOverlaySize(Math.max(36, overlaySize - 12))}
                        className="p-1 rounded-md border hover:bg-gray-50"
                        aria-label="Decrease size"
                      >
                        <MinusCircleIcon className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-medium">{overlaySize}px</span>
                      <button 
                        onClick={() => setOverlaySize(Math.min(400, overlaySize + 12))}
                        className="p-1 rounded-md border hover:bg-gray-50"
                        aria-label="Increase size"
                      >
                        <PlusCircleIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {/* Values display */}
                    <div className="flex gap-8 mb-4 text-sm absolute top-4 left-4">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-500 opacity-60 mr-1"></div>
                        <span className="font-medium">{fontFirst?.name || 'First Font'}: </span>
                        <span className="font-mono">{currentPair.beforeValue !== null ? currentPair.beforeValue : '—'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500 opacity-60 mr-1"></div>
                        <span className="font-medium">{fontSecond?.name || 'Second Font'}: </span>
                        <span className="font-mono">{currentPair.afterValue !== null ? currentPair.afterValue : '—'}</span>
                      </div>
                    </div>

                    {/* First font */}
                    <div className="absolute">
                      <span
                        style={{
                          fontFamily: 'FirstFontPreview',
                          fontSize: `${overlaySize}px`,
                          color: 'rgba(0, 0, 255, 0.6)', // Semi-transparent blue
                          textRendering: 'optimizeLegibility',
                        }}
                      >
                        {currentPair.pair}
                      </span>
                    </div>
                    
                    {/* Second font */}
                    <div className="absolute">
                      <span
                        style={{
                          fontFamily: 'SecondFontPreview',
                          fontSize: `${overlaySize}px`,
                          color: 'rgba(255, 0, 0, 0.6)', // Semi-transparent red
                          textRendering: 'optimizeLegibility',
                        }}
                      >
                        {currentPair.pair}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between gap-4 mt-6">
                    {/* Pair info header */}
                    <div className="flex justify-between items-center gap-4 mb-4">
                      <div>
                        <span className="font-mono text-lg">{currentPair.left},{currentPair.right}</span>
                        <span className="ml-4 text-gray-500">
                          Pair {currentPairIndex + 1} of {filteredPairs.length}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          currentPair.status === 'match' ? 'bg-green-100 text-green-800' :
                          currentPair.status === 'different' ? 'bg-amber-100 text-amber-800' :
                          currentPair.status === 'only-before' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {currentPair.status === 'match' ? 'Match' :
                          currentPair.status === 'different' ? 'Different' :
                          currentPair.status === 'only-before' ? `Only in ${fontFirst?.name || 'First Font'}` :
                          `Only in ${fontSecond?.name || 'Second Font'}`}
                        </span>
                        {currentPair.status === 'different' && (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            currentPair.difference > 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                          }`}>
                            {currentPair.difference > 0 ? '+' : ''}{currentPair.difference}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Navigation buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigateToPair('prev')}
                        className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md flex items-center"
                      >
                        ← Previous
                      </button>
                      <button
                        onClick={() => navigateToPair('next')}
                        className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md flex items-center"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
      {/* Add proper font style tags */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @font-face {
            font-family: 'FirstFontPreview';
            src: url("${fontFirstUrl}") format("${fontFirst?.format || 'opentype'}");
            font-weight: normal;
            font-style: normal;
          }
          
          @font-face {
            font-family: 'SecondFontPreview';
            src: url("${fontSecondUrl}") format("${fontSecond?.format || 'opentype'}");
            font-weight: normal;
            font-style: normal;
          }
        `
      }} />
  </>
);
};

export default KerningComparison;
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
  updateFontName?: (name: string) => void;  // Add this prop
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
  const [previewSize, setPreviewSize] = useState(24); // For the comparison view

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
      const spacingCandidates = analyzePotentialSpacingCandidates({
        ...filteredFirstPairs,
        ...filteredSecondPairs
      });
      
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
        spacingCandidates,
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

  return (
    <div className="mx-4">
    <div className="mx-auto py-4 space-y-2 max-w-7xl mx-4">
      {/* Font preview styles - centralized */}
      <style dangerouslySetInnerHTML={{
        __html: `
          ${fontFirstUrl ? `
            @font-face {
              font-family: 'FirstFontPreview';
              src: url('${fontFirstUrl}') format('truetype');
              font-weight: normal;
              font-style: normal;
            }
          ` : ''}
          
          ${fontSecondUrl ? `
            @font-face {
              font-family: 'SecondFontPreview';
              src: url('${fontSecondUrl}') format('truetype');
              font-weight: normal;
              font-style: normal;
            }
          ` : ''}
        `
      }} />
      
      <div>
        <h1 className="text-2xl font-bold">Kern Compare</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-bold mb-3">Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
          <FontUploader 
            defaultName="First" 
            setFont={setFontFirst} 
            setFontUrl={setFontFirstUrl}
            updateFontName={updateFirstFontName}  // Add this prop
          />
          <FontUploader 
            defaultName="Second" 
            setFont={setFontSecond} 
            setFontUrl={setFontSecondUrl}
            updateFontName={updateSecondFontName}  // Add this prop
          />
        </div>
        
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
        
        <button 
          onClick={compareKerningTables}
          disabled={!fontFirst || !fontSecond || isAnalyzing}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
        >
          {isAnalyzing ? 'Analyzing...' : 'Compare Kerning Tables'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-start">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}
      
      {comparisonResults && (
        <>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-3">Analysis</h2>
            <p className="text-gray-500 mb-5">
              Comparing {fontFirst?.name || 'First'} ({fontFirst?.fileName || 'N/A'}) with {fontSecond?.name || 'Second'} ({fontSecond?.fileName || 'N/A'})
              using the {DICTIONARY_OPTIONS[dictionary]} dictionary
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
              <div className="bg-gray-50 rounded-md p-4 text-center">
                <p className="text-sm text-gray-500">Total Pairs</p>
                <p className="text-2xl font-bold">{comparisonResults.stats.totalPairs}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-4 text-center">
                <p className="text-sm text-gray-500">Matches</p>
                <p className="text-2xl font-bold text-green-600">{comparisonResults.stats.matchCount}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-4 text-center">
                <p className="text-sm text-gray-500">Differences</p>
                <p className="text-2xl font-bold text-amber-600">{comparisonResults.stats.differenceCount}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-4 text-center">
                <p className="text-sm text-gray-500">Only In One Font</p>
                <p className="text-2xl font-bold text-blue-600">
                  {comparisonResults.stats.onlyInBeforeCount + comparisonResults.stats.onlyInAfterCount}
                </p>
              </div>
            </div>
            
            <div className="mb-5">
              <h3 className="text-md font-medium mb-2">Kerning Table Size</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-sm text-gray-500">{fontFirst?.name || 'First'} Pairs</p>
                  <p className="text-lg font-medium">{comparisonResults.stats.beforeTotal}</p>
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
                  <p className="text-lg font-medium">{comparisonResults.stats.afterTotal}</p>
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
              <h3 className="text-md font-medium mb-2">Spacing Candidates</h3>
              <p className="text-sm text-gray-500 mb-3">
                Characters that appear in many kerning pairs may be candidates for spacing adjustments instead
              </p>
              
              {comparisonResults.spacingCandidates.left.length === 0 && 
                comparisonResults.spacingCandidates.right.length === 0 ? (
                <p>No spacing candidates identified</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Left Characters</h4>
                    <div className="space-y-1">
                      {comparisonResults.spacingCandidates.left.map(({char, count}) => (
                        <div key={char} className="flex justify-between p-2 bg-gray-50 rounded">
                          <div className="font-mono text-lg">{char}</div>
                          <div>{count} pairs</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Right Characters</h4>
                    <div className="space-y-1">
                      {comparisonResults.spacingCandidates.right.map(({char, count}) => (
                        <div key={char} className="flex justify-between p-2 bg-gray-50 rounded">
                          <div className="font-mono text-lg">{char}</div>
                          <div>{count} pairs</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-3">Side-by-Side Comparison</h2>
            <p className="text-gray-500 mb-5">
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
            
            <div className="border rounded-md overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pair
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
        </>
      )}
    </div>
    </div>
  );
};

export default KerningComparison;
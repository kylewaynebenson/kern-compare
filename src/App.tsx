import { useState, useEffect, ChangeEvent } from 'react';
import { 
  Check, AlertTriangle, UploadCloud, 
  Type as ZoomIn, ZoomOut, Search, Info 
} from 'lucide-react';
import type { FontData, KerningComparison } from './types';
import { loadFontAndExtractKerning, analyzePotentialSpacingCandidates, analyzeKerningScope } from './utils/fontUtils';
import { DICTIONARY_OPTIONS, getRecommendedPairs, getDictionary, filterPairsByDictionary } from './utils/dictionaries';

interface FontUploaderProps {
  defaultName: string;
  setFont: (font: FontData | null) => void;
  setFontUrl: (url: string | null) => void;
}

// Font Uploader Component
const FontUploader = ({ defaultName, setFont, setFontUrl }: FontUploaderProps) => {
  const [fontName, setFontName] = useState(defaultName);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  
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
      
      // Set font data
      setFont({
        data: fontData.font,
        name: fontName || defaultName,
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
    <div className="space-y-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">Font Name</label>
        <input 
          type="text"
          className="w-full px-3 py-2 border rounded-md"
          value={fontName} 
          onChange={(e) => setFontName(e.target.value)}
          placeholder={defaultName}
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Upload Font File</label>
        <div className="border border-dashed rounded-md p-6 flex flex-col items-center justify-center bg-gray-50">
          <UploadCloud className="mb-2 h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-500 mb-2">
            {progress || "Drag and drop or click to upload"}
          </p>
          <input
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            onChange={handleFileChange}
            className="hidden"
            id={`font-file-${defaultName}`}
          />
          <button 
            className={`px-4 py-2 text-sm border rounded-md ${
              isLoading ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50 text-gray-700'
            }`}
            onClick={() => {
              const element = document.getElementById(`font-file-${defaultName}`);
              if (element) element.click();
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Select Font'}
          </button>
          {fileName && (
            <p className="mt-2 text-sm text-gray-500">{fileName}</p>
          )}
        </div>
      </div>
    </div>
  );
};

interface KerningPreviewProps {
  fontBefore: FontData;
  fontAfter: FontData;
  selectedPairs?: string[];
  dictionaryId?: string;
}

// Kerning Preview Component
const KerningPreview = ({ fontBefore, fontAfter, selectedPairs = [], dictionaryId = 'latin-normal' }: KerningPreviewProps) => {
  const [previewSize, setPreviewSize] = useState(60);
  const [previewText, setPreviewText] = useState('Average Typography');
  const [pairs, setPairs] = useState(() => getRecommendedPairs(dictionaryId));
  const [searchTerm, setSearchTerm] = useState('');
  
  // Update pairs when dictionary changes
  useEffect(() => {
    if (selectedPairs.length === 0) {
      setPairs(getRecommendedPairs(dictionaryId));
    }
  }, [dictionaryId, selectedPairs]);
  
  // If we have selected pairs from the comparison, prioritize those
  const displayPairs = selectedPairs.length > 0 
    ? selectedPairs 
    : pairs.filter(pair => pair.toLowerCase().includes(searchTerm.toLowerCase()));
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium block mb-2">Sample Text</label>
          <input
            type="text"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Enter text to preview"
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setPreviewSize(Math.max(12, previewSize - 4))}
            className="p-1 rounded-md border hover:bg-gray-50"
            aria-label="Decrease size"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="text-sm text-gray-600">{previewSize}px</span>
          <button 
            onClick={() => setPreviewSize(Math.min(96, previewSize + 4))}
            className="p-1 rounded-md border hover:bg-gray-50"
            aria-label="Increase size"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* General text preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-md p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">{fontBefore.name}</h3>
          <div 
            style={{ 
              fontFamily: 'FontBefore', 
              fontSize: `${previewSize}px`, 
              lineHeight: 1.2,
              textRendering: 'optimizeLegibility'
            }}
            className="min-h-16 p-3 border rounded-md bg-gray-50"
          >
            {previewText || 'Typography'}
          </div>
        </div>
        
        <div className="border rounded-md p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">{fontAfter.name}</h3>
          <div 
            style={{ 
              fontFamily: 'FontAfter', 
              fontSize: `${previewSize}px`, 
              lineHeight: 1.2,
              textRendering: 'optimizeLegibility'
            }}
            className="min-h-16 p-3 border rounded-md bg-gray-50"
          >
            {previewText || 'Typography'}
          </div>
        </div>
      </div>
      
      {/* Kerning pair search */}
      {selectedPairs.length === 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Filter kerning pairs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-md"
          />
        </div>
      )}
      
      {/* Kerning pairs preview */}
      <div>
        <h3 className="text-md font-medium mb-3">
          {selectedPairs.length > 0 
            ? 'Selected Kerning Pairs' 
            : `Standard Kerning Pairs (${DICTIONARY_OPTIONS[dictionaryId]})`}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">{fontBefore.name}</h4>
            <div className="space-y-2">
              {displayPairs.map(pair => (
                <div key={pair} className="flex justify-between items-center p-2 border rounded">
                  <span className="font-medium text-sm">{pair}</span>
                  <span 
                    style={{ 
                      fontFamily: 'FontBefore', 
                      fontSize: `${previewSize/1.5}px`,
                      textRendering: 'optimizeLegibility'
                    }}
                  >
                    {pair}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">{fontAfter.name}</h4>
            <div className="space-y-2">
              {displayPairs.map(pair => (
                <div key={pair} className="flex justify-between items-center p-2 border rounded">
                  <span className="font-medium text-sm">{pair}</span>
                  <span 
                    style={{ 
                      fontFamily: 'FontAfter', 
                      fontSize: `${previewSize/1.5}px`,
                      textRendering: 'optimizeLegibility'
                    }}
                  >
                    {pair}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Detail view with kerning values */}
      {selectedPairs.length > 0 && (
        <div>
          <h3 className="text-md font-medium mb-3">Kerning Values</h3>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Pair</th>
                  <th className="px-4 py-2 text-right">{fontBefore.name}</th>
                  <th className="px-4 py-2 text-right">{fontAfter.name}</th>
                  <th className="px-4 py-2 text-right">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selectedPairs.map(pair => {
                  // Find the pair in each font's kerning data
                  const [left, right] = pair.split('');
                  const pairKey = `${left},${right}`;
                  
                  const beforeValue = fontBefore.kerningPairs?.[pairKey] ?? 0;
                  const afterValue = fontAfter.kerningPairs?.[pairKey] ?? 0;
                  const difference = afterValue - beforeValue;
                  
                  return (
                    <tr key={pair} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{pair}</td>
                      <td className="px-4 py-2 text-right">{beforeValue}</td>
                      <td className="px-4 py-2 text-right">{afterValue}</td>
                      <td className={`px-4 py-2 text-right ${
                        difference > 0 ? 'text-green-600' : 
                        difference < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {difference > 0 ? '+' : ''}{difference}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Main application component
const KerningComparison = () => {
  const [fontBefore, setFontBefore] = useState<FontData | null>(null);
  const [fontAfter, setFontAfter] = useState<FontData | null>(null);
  const [discrepancyUnits, setDiscrepancyUnits] = useState(5);
  const [dictionary, setDictionary] = useState('latin-normal');
  const [customDictionary, setCustomDictionary] = useState('');
  const [comparisonResults, setComparisonResults] = useState<KerningComparison | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const [fontBeforeUrl, setFontBeforeUrl] = useState<string | null>(null);
  const [fontAfterUrl, setFontAfterUrl] = useState<string | null>(null);
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [showDictionaryInfo, setShowDictionaryInfo] = useState(false);

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
    if (!fontBefore || !fontAfter) {
      setError('Please upload both fonts to compare');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Get kerning pairs from both fonts
      const beforePairs = fontBefore.kerningPairs || {};
      const afterPairs = fontAfter.kerningPairs || {};
      
      console.log('Before kerning pairs:', Object.keys(beforePairs).length);
      console.log('After kerning pairs:', Object.keys(afterPairs).length);
      
      if (Object.keys(beforePairs).length === 0 && Object.keys(afterPairs).length === 0) {
        setError('No kerning pairs found in either font. Try a different font file or check font format support.');
        setIsAnalyzing(false);
        return;
      }
      
      // Filter pairs based on selected dictionary
      const filteredBeforePairs = filterPairsByDictionary(beforePairs, dictionary);
      const filteredAfterPairs = filterPairsByDictionary(afterPairs, dictionary);
      
      console.log('Filtered before pairs:', Object.keys(filteredBeforePairs).length);
      console.log('Filtered after pairs:', Object.keys(filteredAfterPairs).length);
      
      if (Object.keys(filteredBeforePairs).length === 0 && Object.keys(filteredAfterPairs).length === 0) {
        setError(`No kerning pairs found after filtering with the "${DICTIONARY_OPTIONS[dictionary]}" dictionary. Try a different dictionary.`);
        setIsAnalyzing(false);
        return;
      }
      
      // Find all unique pair keys from the filtered pairs
      const allPairKeys = new Set([
        ...Object.keys(filteredBeforePairs),
        ...Object.keys(filteredAfterPairs)
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
      let onlyInBeforeCount = 0;
      let onlyInAfterCount = 0;
      
      allPairKeys.forEach(pairKey => {
        const [left, right] = pairKey.split(',');
        const beforeValue = filteredBeforePairs[pairKey];
        const afterValue = filteredAfterPairs[pairKey];
        
        let status: 'match' | 'different' | 'only-before' | 'only-after';
        let difference = 0;
        
        if (beforeValue !== undefined && afterValue !== undefined) {
          difference = afterValue - beforeValue;
          
          if (Math.abs(difference) <= discrepancyUnits) {
            status = 'match';
            matchCount++;
          } else {
            status = 'different';
            differenceCount++;
          }
        } else if (beforeValue !== undefined) {
          status = 'only-before';
          onlyInBeforeCount++;
        } else {
          status = 'only-after';
          onlyInAfterCount++;
        }
        
        comparisons.push({
          left,
          right,
          pair: `${left}${right}`, // Concatenated for display
          beforeValue: beforeValue !== undefined ? beforeValue : null,
          afterValue: afterValue !== undefined ? afterValue : null,
          difference,
          status
        });
      });
      
      console.log('Generated comparisons:', comparisons.length);
      console.log('Matches:', matchCount);
      console.log('Differences:', differenceCount);
      console.log('Only in before:', onlyInBeforeCount);
      console.log('Only in after:', onlyInAfterCount);
      
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
        ...filteredBeforePairs,
        ...filteredAfterPairs
      });
      
      // Analyze kerning scope
      const kerningScope = {
        before: analyzeKerningScope(filteredBeforePairs),
        after: analyzeKerningScope(filteredAfterPairs)
      };
      
      setComparisonResults({
        comparisons,
        stats: {
          totalPairs: allPairKeys.size,
          matchCount,
          differenceCount,
          onlyInBeforeCount,
          onlyInAfterCount,
          beforeTotal: Object.keys(filteredBeforePairs).length,
          afterTotal: Object.keys(filteredAfterPairs).length
        },
        spacingCandidates,
        kerningScope
      });
      
      // Reset selected pairs when running a new comparison
      setSelectedPairs([]);
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
  
  // Select a pair for detailed comparison
  const handlePairSelect = (pair: string) => {
    if (selectedPairs.includes(pair)) {
      setSelectedPairs(selectedPairs.filter(p => p !== pair));
    } else {
      setSelectedPairs([...selectedPairs, pair]);
    }
  };

  return (
    <div className="mx-auto py-4 space-y-2 max-w-7xl mx-4">
      <div>
        <h1 className="text-2xl font-bold">Kern Compare</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-bold mb-3">Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
          <FontUploader 
            defaultName="Before" 
            setFont={setFontBefore} 
            setFontUrl={setFontBeforeUrl}
          />
          <FontUploader 
            defaultName="After" 
            setFont={setFontAfter} 
            setFontUrl={setFontAfterUrl}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Units of Discrepancy: {discrepancyUnits}</label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={discrepancyUnits}
              onChange={(e) => setDiscrepancyUnits(parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-sm text-gray-500">
              Kerning pairs with a difference within this range will be considered a match
            </p>
          </div>
          
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
                <h4 className="text-sm font-medium mb-1">About Dictionaries</h4>
                <p className="text-xs text-blue-800">
                  Dictionaries define which character sets will be analyzed in the kerning comparison. 
                  Different dictionaries focus on different aspects of typography:
                </p>
                <ul className="text-xs text-blue-800 mt-1 list-disc pl-4 space-y-1">
                  <li><strong>Latin Normal:</strong> Standard Latin characters</li>
                  <li><strong>Latin Concise:</strong> Focused set of essential characters</li>
                  <li><strong>Latin Expansive:</strong> Comprehensive character set</li>
                  <li><strong>Latin + Punctuation:</strong> Focus on punctuation kerning</li>
                  <li><strong>Numbers:</strong> Numeric characters and monetary symbols</li>
                  <li><strong>Custom:</strong> Define your own character set</li>
                </ul>
                <button 
                  onClick={() => setShowDictionaryInfo(false)}
                  className="text-xs text-blue-800 underline mt-2"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
        
        <button 
          onClick={compareKerningTables}
          disabled={!fontBefore || !fontAfter || isAnalyzing}
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
      
      {/* Font Preview Section */}
      {fontBefore && fontAfter && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-bold mb-3">Font Preview</h2>
          
          {/* Font preview styles */}
          <style dangerouslySetInnerHTML={{
            __html: `
              @font-face {
                font-family: 'FontBefore';
                src: url('${fontBeforeUrl}') format('truetype');
                font-weight: normal;
                font-style: normal;
              }
              
              @font-face {
                font-family: 'FontAfter';
                src: url('${fontAfterUrl}') format('truetype');
                font-weight: normal;
                font-style: normal;
              }
            `
          }} />
          
          <KerningPreview 
            fontBefore={fontBefore}
            fontAfter={fontAfter}
            selectedPairs={selectedPairs}
            dictionaryId={dictionary}
          />
        </div>
      )}
      
      {comparisonResults && (
        <>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-3">Analysis</h2>
            <p className="text-gray-500 mb-5">
              Comparing {fontBefore?.name || 'Before'} ({fontBefore?.fileName || 'N/A'}) with {fontAfter?.name || 'After'} ({fontAfter?.fileName || 'N/A'})
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
              <h3 className="text-md font-medium mb-2">Character Coverage</h3>
              <p className="text-sm text-gray-500 mb-2">
                Characters included in the {DICTIONARY_OPTIONS[dictionary]} dictionary:
              </p>
              <div className="p-3 bg-gray-50 rounded-md font-mono text-sm overflow-x-auto whitespace-nowrap">
                {getDictionary(dictionary).characters}
              </div>
            </div>
            
            <div className="mb-5">
              <h3 className="text-md font-medium mb-2">Kerning Table Size</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-sm text-gray-500">{fontBefore?.name || 'Before'} Pairs</p>
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
                  <p className="text-sm text-gray-500">{fontAfter?.name || 'After'} Pairs</p>
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
            
            <div className="flex flex-wrap justify-between items-center mb-5 gap-3">
              <div className="inline-flex rounded-md shadow-sm border" role="group">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                    activeFilter === 'all' 
                    ? 'bg-blue-50 text-blue-700 border-blue-300' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  All
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
                  Different
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
                  Only in {fontBefore?.name || 'Before'}
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
                  Only in {fontAfter?.name || 'After'}
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
                  Matching
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="differences-only"
                  checked={showOnlyDifferences}
                  onChange={(e) => setShowOnlyDifferences(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="differences-only" className="text-sm font-medium">
                  Show only differences
                </label>
              </div>
            </div>
            
            <div className="border rounded-md overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pair</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{fontBefore?.name || 'Before'}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{fontAfter?.name || 'After'}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difference</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredComparisons().map((comp, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="font-mono">{comp.left},{comp.right}</div>
                          {/* Visual preview of the pair */}
                          <div className="flex space-x-4">
                            <span 
                              style={{ 
                                fontFamily: 'FontBefore', 
                                fontSize: '24px',
                                textRendering: 'optimizeLegibility'
                              }}
                              className="text-gray-700"
                            >
                              {comp.pair}
                            </span>
                            <span 
                              style={{ 
                                fontFamily: 'FontAfter', 
                                fontSize: '24px',
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
                      <td className="px-6 py-4 whitespace-nowrap">
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
                            Only in {fontBefore?.name || 'Before'}
                          </span>
                        )}
                        {comp.status === 'only-after' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Only in {fontAfter?.name || 'After'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handlePairSelect(comp.pair)}
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            selectedPairs.includes(comp.pair)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {selectedPairs.includes(comp.pair) ? 'Selected' : 'Select for Preview'}
                        </button>
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
  );
};

export default KerningComparison;
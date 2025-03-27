import React, { useState, useEffect } from 'react';
import { Check, AlertTriangle, UploadCloud, Type, ZoomIn, ZoomOut } from 'lucide-react';

// Main application component
const KerningComparison = () => {
  const [fontBefore, setFontBefore] = useState(null);
  const [fontAfter, setFontAfter] = useState(null);
  const [discrepancyUnits, setDiscrepancyUnits] = useState(5);
  const [dictionary, setDictionary] = useState('latin-normal');
  const [comparisonResults, setComparisonResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const [previewText, setPreviewText] = useState('Typography');
  const [previewSize, setPreviewSize] = useState(36);
  const [fontBeforeUrl, setFontBeforeUrl] = useState(null);
  const [fontAfterUrl, setFontAfterUrl] = useState(null);

  // Dictionary options
  const DICTIONARIES = {
    'latin-normal': 'Latin Normal',
    'latin-concise': 'Latin Concise',
    'latin-expansive': 'Latin Expansive'
  };

  // Extract kerning pairs from the font
  const extractKerningPairs = (font) => {
    if (!font || !font.kerningPairs) {
      return [];
    }
    
    const pairs = [];
    for (const [leftRight, value] of Object.entries(font.kerningPairs)) {
      const [left, right] = leftRight.split(',');
      pairs.push({
        left,
        right,
        value
      });
    }
    
    return pairs;
  };

  // Compare the kerning tables
  const compareKerningTables = () => {
    if (!fontBefore || !fontAfter) {
      setError('Please upload both fonts to compare');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    
    try {
      const beforePairs = extractKerningPairs(fontBefore.data);
      const afterPairs = extractKerningPairs(fontAfter.data);
      
      // Create maps for easier comparison
      const beforeMap = new Map();
      const afterMap = new Map();
      
      beforePairs.forEach(pair => {
        beforeMap.set(`${pair.left},${pair.right}`, pair.value);
      });
      
      afterPairs.forEach(pair => {
        afterMap.set(`${pair.left},${pair.right}`, pair.value);
      });
      
      // Find all unique pairs
      const allPairs = new Set([
        ...beforeMap.keys(),
        ...afterMap.keys()
      ]);
      
      // Compare pairs
      const comparisons = [];
      let matchCount = 0;
      let differenceCount = 0;
      let onlyInBeforeCount = 0;
      let onlyInAfterCount = 0;
      
      allPairs.forEach(pairKey => {
        const [left, right] = pairKey.split(',');
        const beforeValue = beforeMap.get(pairKey);
        const afterValue = afterMap.get(pairKey);
        
        let status;
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
          beforeValue: beforeValue !== undefined ? beforeValue : null,
          afterValue: afterValue !== undefined ? afterValue : null,
          difference,
          status
        });
      });
      
      // Sort by status and difference magnitude
      comparisons.sort((a, b) => {
        // First by status priority
        const statusPriority = {
          'different': 0,
          'only-before': 1,
          'only-after': 2,
          'match': 3
        };
        
        if (statusPriority[a.status] !== statusPriority[b.status]) {
          return statusPriority[a.status] - statusPriority[b.status];
        }
        
        // Then by difference magnitude for 'different' status
        if (a.status === 'different' && b.status === 'different') {
          return Math.abs(b.difference) - Math.abs(a.difference);
        }
        
        // Then alphabetically by left character
        return a.left.localeCompare(b.left);
      });
      
      // Potential spacing candidates (pairs with many kerning values)
      const leftCharFrequency = {};
      const rightCharFrequency = {};
      
      comparisons.forEach(comp => {
        if (comp.status !== 'match') {
          leftCharFrequency[comp.left] = (leftCharFrequency[comp.left] || 0) + 1;
          rightCharFrequency[comp.right] = (rightCharFrequency[comp.right] || 0) + 1;
        }
      });
      
      const highFrequencyThreshold = 5; // Arbitrary threshold
      
      const highFrequencyLeft = Object.entries(leftCharFrequency)
        .filter(([_, count]) => count >= highFrequencyThreshold)
        .map(([char, count]) => ({ char, count }))
        .sort((a, b) => b.count - a.count);
        
      const highFrequencyRight = Object.entries(rightCharFrequency)
        .filter(([_, count]) => count >= highFrequencyThreshold)
        .map(([char, count]) => ({ char, count }))
        .sort((a, b) => b.count - a.count);
      
      setComparisonResults({
        comparisons,
        stats: {
          totalPairs: allPairs.size,
          matchCount,
          differenceCount,
          onlyInBeforeCount,
          onlyInAfterCount,
          beforeTotal: beforePairs.length,
          afterTotal: afterPairs.length
        },
        spacingCandidates: {
          left: highFrequencyLeft,
          right: highFrequencyRight
        }
      });
    } catch (err) {
      console.error('Error analyzing fonts:', err);
      setError(`Error analyzing fonts: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filter comparisons based on active filter
  const getFilteredComparisons = () => {
    if (!comparisonResults) return [];
    
    let filtered = [...comparisonResults.comparisons];
    
    // Apply status filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(comp => comp.status === activeFilter);
    }
    
    // Apply differences only filter
    if (showOnlyDifferences) {
      filtered = filtered.filter(comp => comp.status !== 'match');
    }
    
    return filtered;
  };

  // Font loading component
  const FontUploader = ({ defaultName, setFont, setFontUrl }) => {
    const [fontName, setFontName] = useState(defaultName);
    const [fileName, setFileName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const handleFileChange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setIsLoading(true);
      setFileName(file.name);
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        // Create a blob URL for the font to use in @font-face
        const fontUrl = URL.createObjectURL(file);
        setFontUrl(fontUrl);
        
        // In a real implementation, we would use opentype.js to parse the font
        // For this prototype, we'll simulate the font data structure
        const font = {
          kerningPairs: simulateKerningPairs()
        };
        
        setFont({ 
          data: font, 
          name: fontName || defaultName,
          fileName: file.name,
          blob: fontUrl
        });
      } catch (error) {
        console.error('Error loading font:', error);
        setError(`Error loading font: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Simulate kerning pairs for demo purposes
    const simulateKerningPairs = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      const pairs = {};
      
      // Generate some random kerning pairs
      for (let i = 0; i < 100; i++) {
        const left = chars[Math.floor(Math.random() * chars.length)];
        const right = chars[Math.floor(Math.random() * chars.length)];
        const value = Math.floor(Math.random() * 100) - 50; // Random value between -50 and 50
        
        pairs[`${left},${right}`] = value;
      }
      
      return pairs;
    };

    return (
      <div className="space-y-4">
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
            <p className="text-sm text-gray-500 mb-2">Drag and drop or click to upload</p>
            <input
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              onChange={handleFileChange}
              className="hidden"
              id={`font-file-${defaultName}`}
            />
            <button 
              className="px-4 py-2 text-sm border rounded-md bg-white hover:bg-gray-50"
              onClick={() => document.getElementById(`font-file-${defaultName}`).click()}
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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Font Kerning Comparison Tool</h1>
        <p className="text-gray-500">
          Upload two fonts to compare their kerning tables and visualize differences
        </p>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Font Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">Units of Discrepancy: {discrepancyUnits}</label>
            <input 
              type="range" 
              min="1" 
              max="100" 
              value={discrepancyUnits}
              onChange={(e) => setDiscrepancyUnits(parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-sm text-gray-500">
              Kerning pairs with a difference within this range will be considered a match
            </p>
          </div>
          
          <div className="space-y-3">
            <label className="text-sm font-medium">Dictionary</label>
            <select 
              value={dictionary} 
              onChange={(e) => setDictionary(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              {Object.entries(DICTIONARIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="text-sm text-gray-500">
              Choose which character set to compare
            </p>
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-8 flex items-start">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}
      
      {/* Font Preview Section */}
      {fontBefore && fontAfter && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Font Preview</h2>
            <div className="flex items-center space-x-2">
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
          
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2">Sample Text</label>
            <div className="flex items-center">
              <Type className="h-5 w-5 mr-2 text-gray-400" />
              <input
                type="text"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Enter text to preview"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>
          
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
          
          {/* Common kerning pair preview */}
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-4">Common Kerning Pairs Preview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">{fontBefore.name}</h4>
                <div className="space-y-2">
                  {['AV', 'To', 'Wa', 'Yo', 'LT', 'Pa', 'Ta', 'Te'].map(pair => (
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
                  {['AV', 'To', 'Wa', 'Yo', 'LT', 'Pa', 'Ta', 'Te'].map(pair => (
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
        </div>
      )}
      
      {comparisonResults && (
        <>
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Comparison Results</h2>
            <p className="text-gray-500 mb-6">
              Comparing {fontBefore.name} ({fontBefore.fileName}) with {fontAfter.name} ({fontAfter.fileName})
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Kerning Table Size</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-sm text-gray-500">{fontBefore.name} Pairs</p>
                  <p className="text-xl font-medium">{comparisonResults.stats.beforeTotal}</p>
                </div>
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-sm text-gray-500">{fontAfter.name} Pairs</p>
                  <p className="text-xl font-medium">{comparisonResults.stats.afterTotal}</p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-3">Spacing Candidates</h3>
              <p className="text-sm text-gray-500 mb-4">
                Characters that appear in many kerning pairs may be candidates for spacing adjustments instead
              </p>
              
              {comparisonResults.spacingCandidates.left.length === 0 && 
                comparisonResults.spacingCandidates.right.length === 0 ? (
                <p>No spacing candidates identified</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Side-by-Side Comparison</h2>
            <p className="text-gray-500 mb-6">
              Visual comparison of kerning pairs between fonts
            </p>
            
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
              <div className="inline-flex rounded-md shadow-sm" role="group">
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
                  className={`px-4 py-2 text-sm font-medium border-t border-b ${
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
                  className={`px-4 py-2 text-sm font-medium border-t border-b ${
                    activeFilter === 'only-before' 
                    ? 'bg-blue-50 text-blue-700 border-blue-300' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Only in {fontBefore.name}
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
                  Only in {fontAfter.name}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{fontBefore.name}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{fontAfter.name}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difference</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredComparisons().map((comp, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                              {comp.left}{comp.right}
                            </span>
                            <span 
                              style={{ 
                                fontFamily: 'FontAfter', 
                                fontSize: '24px',
                                textRendering: 'optimizeLegibility'
                              }}
                              className="text-gray-700"
                            >
                              {comp.left}{comp.right}
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
                            Only in {fontBefore.name}
                          </span>
                        )}
                        {comp.status === 'only-after' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Only in {fontAfter.name}
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
  );
};

export default KerningComparison;
/**
 * Utility functions for data compression and optimization
 * Used to reduce storage size and improve performance
 */

/**
 * Compress data using a simple LZ-based compression algorithm
 * This is a lightweight implementation suitable for browser extensions
 * 
 * @param data - The data to compress (will be stringified if not a string)
 * @returns Compressed data as a string
 */
export function compressData(data: any): string {
  // Convert data to string if it's not already
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Simple dictionary-based compression
  const dictionary: Record<string, number> = {};
  let dictionarySize = 256; // Start after ASCII chars
  let result = [];
  let word = "";
  
  // Process each character
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];
    const wordChar = word + char;
    
    if (dictionary[wordChar] !== undefined) {
      word = wordChar;
    } else {
      // Add the word code to the result
      result.push(word.length > 1 ? dictionary[word] : word.charCodeAt(0));
      
      // Add the new word to the dictionary
      dictionary[wordChar] = dictionarySize++;
      word = char;
    }
  }
  
  // Handle the last word
  if (word !== "") {
    result.push(word.length > 1 ? dictionary[word] : word.charCodeAt(0));
  }
  
  // Convert to a more compact representation
  return result.map(code => String.fromCharCode(code)).join('');
}

/**
 * Decompress data that was compressed with compressData
 * 
 * @param compressedData - The compressed data string
 * @returns The decompressed data (parsed from JSON if it was an object)
 */
export function decompressData(compressedData: string): any {
  // Convert the compressed string back to codes
  const codes = Array.from(compressedData).map(char => char.charCodeAt(0));
  
  // Rebuild the dictionary
  const dictionary: Record<number, string> = {};
  let dictionarySize = 256; // Start after ASCII chars
  
  // Initialize with ASCII characters
  for (let i = 0; i < 256; i++) {
    dictionary[i] = String.fromCharCode(i);
  }
  
  let result = "";
  let word = String.fromCharCode(codes[0]);
  result += word;
  
  // Process each code
  for (let i = 1; i < codes.length; i++) {
    const code = codes[i];
    let entry: string;
    
    if (dictionary[code] !== undefined) {
      entry = dictionary[code];
    } else if (code === dictionarySize) {
      entry = word + word[0];
    } else {
      throw new Error('Invalid compressed data');
    }
    
    result += entry;
    
    // Add to dictionary
    dictionary[dictionarySize++] = word + entry[0];
    word = entry;
  }
  
  // Try to parse as JSON if it looks like JSON
  try {
    if (result.startsWith('{') || result.startsWith('[')) {
      return JSON.parse(result);
    }
  } catch (e) {
    // If parsing fails, return as string
  }
  
  return result;
}

/**
 * Check if data should be compressed based on size and type
 * 
 * @param data - The data to check
 * @returns Boolean indicating if compression should be applied
 */
export function shouldCompress(data: any): boolean {
  // Don't compress small data
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Only compress data larger than 1KB
  return jsonString.length > 1024;
}

/**
 * Compress an object if it meets the compression threshold
 * 
 * @param data - The data to potentially compress
 * @returns An object with the data and a flag indicating if it's compressed
 */
export function maybeCompressData(data: any): { data: any; compressed: boolean } {
  if (shouldCompress(data)) {
    return {
      data: compressData(data),
      compressed: true
    };
  }
  
  return {
    data,
    compressed: false
  };
}

/**
 * Decompress data if it's marked as compressed
 * 
 * @param container - Object containing data and compressed flag
 * @returns The original data
 */
export function maybeDecompressData(container: { data: any; compressed: boolean }): any {
  if (container && container.compressed) {
    return decompressData(container.data);
  }
  
  return container.data;
}

/**
 * Batch multiple storage operations for better performance
 * 
 * @param operations - Array of storage operations to perform
 * @returns Promise that resolves when all operations are complete
 */
export async function batchStorageOperations(
  operations: Array<{ key: string; data: any }>
): Promise<void> {
  const storageObj: Record<string, any> = {};
  
  // Process each operation
  operations.forEach(op => {
    const { data, compressed } = maybeCompressData(op.data);
    
    // Store the data with compression metadata
    storageObj[op.key] = {
      data,
      compressed,
      timestamp: Date.now() // Add timestamp for cache management
    };
  });
  
  // Perform a single storage operation
  await chrome.storage.local.set(storageObj);
}
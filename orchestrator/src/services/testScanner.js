/**
 * Test scanner - discovers and extracts metadata from test files
 */

const fs = require('fs').promises;
const path = require('path');

class TestScanner {
  constructor(testsDirectory) {
    this.testsDirectory = testsDirectory;
  }

  /**
   * Scan for all test files
   * @returns {Array} Array of test file information
   */
  async scanTests() {
    try {
      const files = await fs.readdir(this.testsDirectory);
      const testFiles = files.filter(file => file.endsWith('.spec.js'));

      const tests = await Promise.all(
        testFiles.map(file => this.extractTestMetadata(file))
      );

      return tests.filter(test => test !== null);
    } catch (error) {
      console.error('Error scanning tests:', error);
      return [];
    }
  }

  /**
   * Extract metadata from a test file
   * @param {string} filename - Test filename
   * @returns {Object} Test information with metadata
   */
  async extractTestMetadata(filename) {
    try {
      const filePath = path.join(this.testsDirectory, filename);
      const content = await fs.readFile(filePath, 'utf-8');

      // Extract metadata from comment block
      const metadata = this.parseMetadataComment(content);

      return {
        file: filename,
        path: filePath,
        metadata: metadata || {
          name: filename.replace('.spec.js', ''),
          description: 'No description available',
          parameters: []
        }
      };
    } catch (error) {
      console.error(`Error reading test file ${filename}:`, error);
      return null;
    }
  }

  /**
   * Parse metadata from special comment block in test file
   * Looks for: @test-metadata { ... JSON ... }
   * @param {string} content - File content
   * @returns {Object|null} Parsed metadata or null
   */
  parseMetadataComment(content) {
    // Look for @test-metadata comment block
    const metadataRegex = /\/\*\*[\s\S]*?@test-metadata\s*\n([\s\S]*?)\*\//;
    const match = content.match(metadataRegex);

    if (!match) {
      return null;
    }

    try {
      // Extract the content between @test-metadata and */
      const rawContent = match[1];
      
      // Clean up the JSON (remove leading * from each line)
      const jsonStr = rawContent
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(line => line.length > 0)
        .join('\n');

      // Additional validation: ensure it starts with { and ends with }
      if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) {
        console.error('Metadata does not appear to be valid JSON object');
        return null;
      }

      const parsed = JSON.parse(jsonStr);
      return parsed;
    } catch (error) {
      console.error('Error parsing test metadata JSON:', error);
      console.error('Raw match:', match[0].substring(0, 200) + '...');
      return null;
    }
  }

  /**
   * Get metadata for a specific test file
   * @param {string} filename - Test filename
   * @returns {Object} Test metadata
   */
  async getTestMetadata(filename) {
    return await this.extractTestMetadata(filename);
  }
}

module.exports = TestScanner;

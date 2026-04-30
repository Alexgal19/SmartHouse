import { extractPassportData } from '../extract-passport-data-flow';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock the AI SDK
jest.mock('@google/generative-ai');

describe('extractPassportData Flow', () => {
  const mockApiKey = 'test-api-key';
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, GOOGLE_GENAI_API_KEY: mockApiKey };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('successfully extracts simple names', async () => {
    const mockResponse = {
      response: {
        text: () => JSON.stringify({
          firstName: 'Jan',
          lastName: 'Kowalski',
          nationality: 'Polska',
          passportNumber: 'EA1234567'
        })
      }
    };

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: jest.fn().mockResolvedValue(mockResponse)
      })
    }));

    const result = await extractPassportData({ photoDataUri: 'data:image/jpeg;base64,abc' });
    
    expect(result.firstName).toBe('Jan');
    expect(result.lastName).toBe('Kowalski');
    expect(result.passportNumber).toBe('EA1234567');
  });

  it('correctly handles multi-part names (Colombian/Spanish style)', async () => {
    const mockResponse = {
      response: {
        text: () => JSON.stringify({
          firstName: 'Juan Carlos',
          lastName: 'Escobar Calderon',
          nationality: 'Kolumbia',
          passportNumber: 'CO9876543'
        })
      }
    };

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: jest.fn().mockResolvedValue(mockResponse)
      })
    }));

    const result = await extractPassportData({ photoDataUri: 'data:image/jpeg;base64,abc' });
    
    expect(result.firstName).toBe('Juan Carlos');
    expect(result.lastName).toBe('Escobar Calderon');
  });

  it('correctly handles multi-part names (Indian style)', async () => {
    const mockResponse = {
      response: {
        text: () => JSON.stringify({
          firstName: 'Abhishek Singh',
          lastName: 'Kumar',
          nationality: 'Indie',
          passportNumber: 'Z1234567'
        })
      }
    };

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: jest.fn().mockResolvedValue(mockResponse)
      })
    }));

    const result = await extractPassportData({ photoDataUri: 'data:image/jpeg;base64,abc' });
    
    expect(result.firstName).toBe('Abhishek Singh');
    expect(result.lastName).toBe('Kumar');
  });

  it('retries on 429 Rate Limit error and eventually succeeds', async () => {
    const mockGenerateContent = jest.fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({ firstName: 'Success', lastName: 'After Retry' })
        }
      });

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: mockGenerateContent
      })
    }));

    const result = await extractPassportData({ photoDataUri: 'data:image/jpeg;base64,abc' });
    
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.firstName).toBe('Success');
  }, 10000);

  it('throws a descriptive error after maximum retries on 429', async () => {
    const mockGenerateContent = jest.fn().mockRejectedValue(new Error('Resource exhausted (429)'));

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: mockGenerateContent
      })
    }));

    await expect(extractPassportData({ photoDataUri: 'data:image/jpeg;base64,abc' }))
      .rejects.toThrow(/Przekroczono limit zapytań do AI/);
    
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  }, 15000); // Increased timeout to 15s to cover retries (2s + 4s)

  it('cleans up markdown JSON blocks from AI response', async () => {
    const mockResponse = {
      response: {
        text: () => '```json\n{"firstName": "Cleaned", "lastName": "JSON"}\n```'
      }
    };

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: jest.fn().mockResolvedValue(mockResponse)
      })
    }));

    const result = await extractPassportData({ photoDataUri: 'data:image/jpeg;base64,abc' });
    expect(result.firstName).toBe('Cleaned');
  });
});

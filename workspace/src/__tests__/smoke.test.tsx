import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

// Prosty komponent tylko na potrzeby testu
const HelloWorld = ({ name }: { name: string }) => {
  return <h1>Witaj, {name}!</h1>;
};

describe('System Testów (Smoke Test)', () => {
  it('prawidłowo renderuje komponenty React', () => {
    render(<HelloWorld name="Gemini" />);
    
    // Sprawdzamy czy tekst pojawił się w "wirtualnym DOM"
    const heading = screen.getByRole('heading', { level: 1 });
    
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Witaj, Gemini!');
  });

  it('obsługuje proste obliczenia matematyczne', () => {
    expect(2 + 2).toBe(4);
  });
});
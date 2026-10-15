// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('tsx harness smoke', () => {
  it('renders a TSX component', () => {
    render(<button type="button">Smoke</button>);
    expect(screen.getByRole('button', { name: 'Smoke' })).toBeTruthy();
  });
});

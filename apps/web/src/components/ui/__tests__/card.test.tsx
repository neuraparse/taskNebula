import { render, screen } from '@testing-library/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../card';

describe('Card', () => {
  it('renders all composed pieces with their children', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title text</CardTitle>
          <CardDescription>Description text</CardDescription>
        </CardHeader>
        <CardContent>Content text</CardContent>
        <CardFooter>Footer text</CardFooter>
      </Card>
    );

    expect(screen.getByText('Title text')).toBeInTheDocument();
    expect(screen.getByText('Description text')).toBeInTheDocument();
    expect(screen.getByText('Content text')).toBeInTheDocument();
    expect(screen.getByText('Footer text')).toBeInTheDocument();
  });

  it('renders CardTitle as an h3 element', () => {
    render(
      <Card>
        <CardTitle>Heading</CardTitle>
      </Card>
    );
    const heading = screen.getByText('Heading');
    expect(heading.tagName).toBe('H3');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs';

describe('Tabs', () => {
  function renderTabs() {
    return render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First panel</TabsContent>
        <TabsContent value="two">Second panel</TabsContent>
      </Tabs>
    );
  }

  it('shows the default tab content', () => {
    renderTabs();
    expect(screen.getByText('First panel')).toBeInTheDocument();
    expect(screen.queryByText('Second panel')).not.toBeInTheDocument();
  });

  it('switches to second tab when clicked', async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole('tab', { name: /two/i }));
    expect(screen.getByText('Second panel')).toBeInTheDocument();
    expect(screen.queryByText('First panel')).not.toBeInTheDocument();
  });
});

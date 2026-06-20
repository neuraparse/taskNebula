'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown, Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganization } from '@/lib/hooks/use-organization';
import { cn } from '@/lib/utils';
import { CreateOrganizationDialog } from './create-organization-dialog';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount?: number;
}

function OrgAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  return (
    <span className="bg-primary/10 text-primary inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold">
      {initials}
    </span>
  );
}

export function OrganizationSwitcher() {
  const [open, setOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [canCreateOrganizations, setCanCreateOrganizations] = useState(false);
  const [loading, setLoading] = useState(true);
  const { currentOrganizationId, setCurrentOrganization } = useOrganization();
  const t = useTranslations('projectsPages');

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations);
        setCanCreateOrganizations(data.canCreateOrganizations === true);
        if (!currentOrganizationId && data.organizations.length > 0) {
          setCurrentOrganization(data.organizations[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentOrg = organizations.find((org) => org.id === currentOrganizationId);

  if (loading) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground w-[180px] justify-between px-2"
        disabled
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">{t('loading')}</span>
        </span>
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={t('org_switch_aria')}
          className="h-9 w-[180px] justify-between gap-2 px-2 transition-colors duration-200"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {currentOrg ? (
              <OrgAvatar name={currentOrg.name} />
            ) : (
              <Building2 className="text-muted-foreground h-4 w-4 shrink-0" />
            )}
            <span className="truncate text-sm font-medium">
              {currentOrg?.name || t('org_select')}
            </span>
          </span>
          <ChevronsUpDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="data-[state=open]:animate-scale-in w-[200px] shadow-sm"
        align="start"
        sideOffset={4}
      >
        {organizations.length === 0 ? (
          <DropdownMenuItem disabled className="text-muted-foreground text-sm">
            {t('org_none')}
          </DropdownMenuItem>
        ) : (
          organizations.map((org) => {
            const isActive = org.id === currentOrganizationId;
            return (
              <DropdownMenuItem
                key={org.id}
                className={cn(
                  'flex min-h-[36px] items-center gap-2 px-2 transition-colors duration-200',
                  isActive && 'bg-accent'
                )}
                onSelect={() => {
                  setCurrentOrganization(org.id);
                  setOpen(false);
                }}
              >
                <OrgAvatar name={org.name} />
                <span className="flex-1 truncate text-sm">{org.name}</span>
                {isActive ? (
                  <Check className="text-primary h-3.5 w-3.5 shrink-0" />
                ) : org.memberCount != null ? (
                  <span className="chip text-[10px]">{org.memberCount}</span>
                ) : null}
              </DropdownMenuItem>
            );
          })
        )}
        {canCreateOrganizations ? (
          <>
            <DropdownMenuSeparator />
            <CreateOrganizationDialog
              trigger={
                <DropdownMenuItem
                  className="min-h-[36px] gap-2 px-2 text-sm transition-colors duration-200"
                  onSelect={(e) => e.preventDefault()}
                >
                  <Plus className="text-muted-foreground h-4 w-4 shrink-0" />
                  {t('org_create_title')}
                </DropdownMenuItem>
              }
            />
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

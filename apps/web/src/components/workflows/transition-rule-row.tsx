'use client';

import { ArrowRight, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  type ApproverRole,
  type ProjectRole,
  type ProjectState,
  type TransitionRule,
} from '@/lib/workflows/use-workflow-builder';

const ALLOWED_ROLES: { value: ProjectRole; labelKey: string }[] = [
  { value: 'admin', labelKey: 'role_admin' },
  { value: 'member', labelKey: 'role_member' },
  { value: 'guest', labelKey: 'role_guest' },
];

const APPROVER_ROLES: { value: ApproverRole; labelKey: string }[] = [
  { value: 'admin', labelKey: 'role_admin' },
  { value: 'member', labelKey: 'role_member' },
];

function StateBadge({
  state,
  unknownLabel,
}: {
  state: ProjectState | undefined;
  unknownLabel: string;
}) {
  if (!state) {
    return (
      <span className="border-border bg-muted text-muted-foreground inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium">
        {unknownLabel}
      </span>
    );
  }
  return (
    <span className="border-border bg-card inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] font-medium">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: `var(--color-${state.color}-500, currentColor)` }}
      />
      {state.name}
    </span>
  );
}

export interface TransitionRuleRowProps {
  rule: TransitionRule;
  states: ProjectState[];
  onChange: (next: TransitionRule) => void;
  onRemove: () => void;
}

export function TransitionRuleRow({ rule, states, onChange, onRemove }: TransitionRuleRowProps) {
  const t = useTranslations('projectConfig');
  const fromState = states.find((state) => state.id === rule.fromStateId);
  const toState = states.find((state) => state.id === rule.toStateId);

  function toggleAllowedRole(role: ProjectRole, checked: boolean) {
    const next = checked
      ? Array.from(new Set<ProjectRole>([...rule.allowedRoles, role]))
      : rule.allowedRoles.filter((existing) => existing !== role);
    onChange({ ...rule, allowedRoles: next });
  }

  function toggleApproverRole(role: ApproverRole, checked: boolean) {
    const current = rule.approverRoles ?? [];
    const next = checked
      ? Array.from(new Set<ApproverRole>([...current, role]))
      : current.filter((existing) => existing !== role);
    onChange({ ...rule, approverRoles: next });
  }

  function handleRequiresApproval(checked: boolean) {
    if (checked) {
      onChange({
        ...rule,
        requiresApproval: true,
        approverRoles:
          rule.approverRoles && rule.approverRoles.length > 0 ? rule.approverRoles : ['admin'],
        approvedTargetStateId: rule.approvedTargetStateId ?? rule.toStateId,
      });
    } else {
      onChange({
        ...rule,
        requiresApproval: false,
      });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <StateBadge state={fromState} unknownLabel={t('state_unknown')} />
            <ArrowRight className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
            <StateBadge state={toState} unknownLabel={t('state_unknown')} />
          </div>
          <p className="text-muted-foreground text-xs">{t('rule_define_help')}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onRemove}
          aria-label={t('remove_transition')}
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          {t('allowed_roles')}
        </Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ALLOWED_ROLES.map((role) => {
            const checked = rule.allowedRoles.includes(role.value);
            const id = `${rule.id}-allow-${role.value}`;
            return (
              <label
                key={role.value}
                htmlFor={id}
                className="border-border bg-card hover:bg-accent/40 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(value) => toggleAllowedRole(role.value, Boolean(value))}
                />
                <span>{t(role.labelKey)}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="border-border bg-card space-y-4 rounded-md border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="text-accent-blue mt-0.5 h-4 w-4" aria-hidden="true" />
            <div>
              <Label htmlFor={`${rule.id}-requires-approval`} className="text-sm font-medium">
                {t('requires_approval')}
              </Label>
              <p className="text-muted-foreground text-xs">{t('requires_approval_hint')}</p>
            </div>
          </div>
          <Switch
            id={`${rule.id}-requires-approval`}
            checked={rule.requiresApproval}
            onCheckedChange={handleRequiresApproval}
          />
        </div>

        {rule.requiresApproval ? (
          <div className="border-border space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                {t('approver_roles')}
              </Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {APPROVER_ROLES.map((role) => {
                  const checked = (rule.approverRoles ?? []).includes(role.value);
                  const id = `${rule.id}-approver-${role.value}`;
                  return (
                    <label
                      key={role.value}
                      htmlFor={id}
                      className="border-border bg-background hover:bg-accent/40 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(value) => toggleApproverRole(role.value, Boolean(value))}
                      />
                      <span>{t(role.labelKey)}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  {t('approved_target_state')}
                </Label>
                <Select
                  value={rule.approvedTargetStateId ?? rule.toStateId}
                  onValueChange={(value) => onChange({ ...rule, approvedTargetStateId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_state')} />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state) => (
                      <SelectItem key={state.id} value={state.id}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  {t('rejected_target_state')}
                </Label>
                <Select
                  value={rule.rejectedTargetStateId ?? rule.fromStateId}
                  onValueChange={(value) => onChange({ ...rule, rejectedTargetStateId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_state')} />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state) => (
                      <SelectItem key={state.id} value={state.id}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default TransitionRuleRow;

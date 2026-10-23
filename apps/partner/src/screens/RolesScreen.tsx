import { useEffect, useState } from 'react';
import type { PartnerApplicationDto } from '@lahloba/contracts';
import type { PublicRoleInterface } from '@lahloba/domain';
import { Button, Card, LanguageSwitch, Notice, Row, Screen, Text, useLocale } from '@lahloba/ui';
import { usePartner } from '../PartnerContext';

const KINDS = ['CHEF', 'SUPPLIER', 'COURIER'] as const;

/**
 * Explicit role switcher (doc 01 §1.2): each membership is its own interface; switching never
 * merges permissions. The server enforces scoped authorization regardless of this UI.
 */
export function RolesScreen() {
  const { me, interfaces, activeRole, switchRole, nav, api, auth } = usePartner();
  const { t } = useLocale();
  const [apps, setApps] = useState<PartnerApplicationDto[]>([]);

  useEffect(() => {
    if (me) api.myApplications().then((r) => setApps(r.items), () => setApps([]));
  }, [me, api]);

  if (!me) return <Screen><Text>{t('common.loading')}</Text></Screen>;
  const roleLabel = (ui: PublicRoleInterface) => t(`partner.role.${ui}` as const);
  const partnerInterfaces = interfaces.filter((i) => i.ui !== 'CUSTOMER');
  const held = new Set(partnerInterfaces.map((i) => i.ui));

  const open = (ui: PublicRoleInterface, scopeId: string | null) => {
    switchRole({ ui, scopeId });
    if (ui === 'CHEF' && scopeId) nav.push(`/chef/${scopeId}`);
    else if (ui === 'SUPPLIER') nav.push('/supplier');
    else if (ui === 'COURIER') nav.push('/courier');
  };

  return (
    <Screen testID="roles">
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="display" role="header">{t('partner.roles')}</Text>
        <LanguageSwitch />
      </Row>
      {activeRole ? <Text testID="active-role">{t('partner.activeRole', { role: roleLabel(activeRole.ui) })}</Text> : null}
      {partnerInterfaces.length === 0 ? <Text muted>{t('partner.noRoles')}</Text> : null}
      {partnerInterfaces.map((i) => (
        <Card key={`${i.ui}-${i.scopeId}`} testID={`role-${i.ui}`}>
          <Text variant="title">{roleLabel(i.ui)}</Text>
          <Text variant="caption" muted>{t(`partner.state.${i.approvalState}` as 'partner.state.PENDING')}</Text>
          {i.approvalState === 'PENDING' ? <Notice>{t('partner.pendingAccess')}</Notice> : null}
          {i.approvalState === 'APPROVED' || i.approvalState === 'PENDING' ? (
            <Button variant="secondary" label={t('partner.switchTo', { role: roleLabel(i.ui) })} onPress={() => open(i.ui, i.scopeId)} testID={`switch-${i.ui}`} />
          ) : null}
        </Card>
      ))}

      <Text variant="title" role="header">{t('partner.myApplications')}</Text>
      {apps.map((a) => (
        <Card key={a.id} testID={`application-${a.id}`}>
          <Text variant="label">{roleLabel(a.kind)} · {a.status}</Text>
          {a.permittedNextStep ? <Text>{t('partner.rejectedNextStep', { step: a.permittedNextStep })}</Text> : null}
        </Card>
      ))}
      <Row wrap>
        {KINDS.filter((k) => !held.has(k)).map((k) => (
          <Button key={k} label={t('partner.applyAs', { role: roleLabel(k) })} onPress={() => nav.push(`/apply/${k}`)} testID={`apply-${k}`} />
        ))}
      </Row>
      <Button variant="secondary" label={t('common.signOut')} onPress={() => { void auth.signOut(); switchRole(null); nav.replace('/'); }} />
    </Screen>
  );
}

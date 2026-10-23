import { useEffect, useRef, useState } from 'react';
import { ApiError, newIdempotencyKey, type Area, type CreatePartnerApplication, type PartnerApplicationDto } from '@lahloba/contracts';
import { pickLocalized } from '@lahloba/i18n';
import { Button, Chip, Notice, Row, Screen, Text, TextField, useLocale } from '@lahloba/ui';
import { usePartner } from '../PartnerContext';

type Kind = 'CHEF' | 'SUPPLIER' | 'COURIER';
const EQUIPMENT = ['INSULATED_BAG', 'COLD_BOX', 'BICYCLE', 'MOTORCYCLE', 'CAR'] as const;

/** H01 / S01 / D01 application forms with manual address entry (no map dependency). */
export function ApplyScreen(props: { kind: Kind }) {
  const { api, refreshMe, nav } = usePartner();
  const { t, locale } = useLocale();
  const [areas, setAreas] = useState<Area[]>([]);
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<PartnerApplicationDto | null>(null);
  const [evidenceCount, setEvidenceCount] = useState(0);
  // One idempotency key per form instance: a double tap or retry cannot create two applications.
  const key = useRef(newIdempotencyKey());

  useEffect(() => {
    api.areas().then((r) => setAreas(r.items), () => setAreas([]));
  }, [api]);

  const required = t('partner.form.required');
  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = required;
    if (props.kind !== 'COURIER') {
      if (!areaId) e.area = required;
      if (address.trim().length < 5) e.address = required;
    }
    if (props.kind === 'SUPPLIER' && orgName.trim().length < 2) e.orgName = required;
    if (props.kind === 'COURIER' && equipment.length === 0) e.equipment = required;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const body = (): CreatePartnerApplication => {
    const served = [...new Set([areaId!, ...serviceAreas])];
    if (props.kind === 'CHEF') {
      return { kind: 'CHEF', chef: { publicName: name.trim(), publicAreaId: areaId!, serviceAreaIds: served, kitchenAddress: { addressText: address.trim(), areaId: areaId! } } };
    }
    if (props.kind === 'SUPPLIER') {
      return { kind: 'SUPPLIER', supplier: { organizationName: orgName.trim(), branch: { publicName: name.trim(), areaId: areaId!, serviceAreaIds: served, address: { addressText: address.trim(), areaId: areaId! } } } };
    }
    return { kind: 'COURIER', courier: { displayName: name.trim(), equipment: equipment as Array<(typeof EQUIPMENT)[number]> } };
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const r = await api.applyAsPartner(body(), key.current);
      setSubmitted(r);
      await refreshMe();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : t('common.error.generic'));
    } finally {
      setBusy(false);
    }
  };

  const addEvidence = async () => {
    if (!submitted) return;
    // Metadata reference only — no file is uploaded until the private storage adapter exists.
    await api.registerEvidence(submitted.id, {
      evidenceType: props.kind === 'COURIER' ? 'DRIVING_LICENSE' : props.kind === 'SUPPLIER' ? 'COMMERCIAL_REGISTRATION' : 'NATIONAL_ID',
      contentType: 'application/pdf', byteSize: 1,
    });
    setEvidenceCount((n) => n + 1);
  };

  const roleLabel = t(`partner.role.${props.kind}` as const);
  if (submitted) {
    return (
      <Screen testID="apply-done">
        <Text variant="display" role="header">{t('partner.applyAs', { role: roleLabel })}</Text>
        <Notice testID="application-submitted">{t('partner.applicationSubmitted')}</Notice>
        <Text variant="title">{t('partner.evidence')}</Text>
        <Notice tone="warning">{t('partner.evidenceDisabled')}</Notice>
        <Button variant="secondary" label={t('partner.addEvidence')} onPress={addEvidence} testID="add-evidence" />
        {evidenceCount ? <Text testID="evidence-count">{t('partner.evidenceAdded', { count: evidenceCount })}</Text> : null}
        <Button label={t('common.back')} onPress={() => nav.replace('/roles')} />
      </Screen>
    );
  }

  return (
    <Screen testID={`apply-${props.kind}`}>
      <Button variant="secondary" label={t('common.back')} onPress={() => nav.back()} />
      <Text variant="display" role="header">{t('partner.applyAs', { role: roleLabel })}</Text>
      {props.kind === 'SUPPLIER' ? <TextField label={t('partner.form.orgName')} value={orgName} onChangeText={setOrgName} error={errors.orgName} testID="org-name" /> : null}
      <TextField
        label={props.kind === 'CHEF' ? t('partner.form.publicName') : props.kind === 'SUPPLIER' ? t('partner.form.branchName') : t('partner.form.displayName')}
        value={name} onChangeText={setName} error={errors.name} testID="name"
      />
      {props.kind !== 'COURIER' ? (
        <>
          <Text variant="label">{t('partner.form.area')}</Text>
          <Row wrap>
            {areas.map((a) => (
              <Chip key={a.id} label={pickLocalized(locale, a.label.en, a.label.ar)} selected={areaId === a.id} onToggle={() => setAreaId(a.id)} testID={`area-${a.slug}`} />
            ))}
          </Row>
          {errors.area ? <Text tone="danger" variant="caption">{errors.area}</Text> : null}
          <Text variant="label">{t('partner.form.serviceAreas')}</Text>
          <Row wrap>
            {areas.map((a) => (
              <Chip key={a.id} label={pickLocalized(locale, a.label.en, a.label.ar)} selected={a.id === areaId || serviceAreas.includes(a.id)}
                onToggle={() => setServiceAreas((s) => (s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]))} testID={`serve-${a.slug}`} />
            ))}
          </Row>
          <TextField label={props.kind === 'CHEF' ? t('partner.form.kitchenAddress') : t('partner.form.branchAddress')} hint={t('partner.kitchenAddressPrivate')}
            value={address} onChangeText={setAddress} multiline error={errors.address} testID="address" />
        </>
      ) : (
        <>
          <Text variant="label">{t('partner.equipment')}</Text>
          <Row wrap>
            {EQUIPMENT.map((e) => (
              <Chip key={e} label={t(`equipment.${e}` as const)} selected={equipment.includes(e)}
                onToggle={() => setEquipment((s) => (s.includes(e) ? s.filter((x) => x !== e) : [...s, e]))} testID={`equipment-${e}`} />
            ))}
          </Row>
          {errors.equipment ? <Text tone="danger" variant="caption">{errors.equipment}</Text> : null}
        </>
      )}
      {submitError ? <Notice tone="danger">{submitError}</Notice> : null}
      <Button label={t('partner.apply')} onPress={submit} loading={busy} testID="submit-application" />
    </Screen>
  );
}

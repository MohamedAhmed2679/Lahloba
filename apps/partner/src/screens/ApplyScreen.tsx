import { useEffect, useRef, useState } from 'react';
import { ApiError, newIdempotencyKey, type Area, type CreatePartnerApplication, type PartnerApplicationDto } from '@lahloba/contracts';
import { pickLocalized } from '@lahloba/i18n';
import { Button, Card, Chip, Notice, Row, Screen, StatusBadge, Text, TextField, useLocale } from '@lahloba/ui';
import type { FileSource } from '../filePicker';
import { usePartner } from '../PartnerContext';

type Kind = 'CHEF' | 'SUPPLIER' | 'COURIER';
const EQUIPMENT = ['INSULATED_BAG', 'COLD_BOX', 'BICYCLE', 'MOTORCYCLE', 'CAR'] as const;
type DocType = 'NATIONAL_ID' | 'KITCHEN_PHOTO' | 'FOOD_HANDLER_CERTIFICATE' | 'COMMERCIAL_REGISTRATION' | 'TAX_CARD' | 'DRIVING_LICENSE' | 'VEHICLE_LICENSE';
const DOCS: Record<Kind, DocType[]> = {
  CHEF: ['NATIONAL_ID', 'KITCHEN_PHOTO', 'FOOD_HANDLER_CERTIFICATE'],
  SUPPLIER: ['COMMERCIAL_REGISTRATION', 'TAX_CARD', 'NATIONAL_ID'],
  COURIER: ['NATIONAL_ID', 'DRIVING_LICENSE', 'VEHICLE_LICENSE'],
};
type DocState = { state: 'uploading' | 'uploaded' | 'referenceOnly' | 'failed'; error?: string };
const KNOWN_ERRORS = ['UNSUPPORTED_FILE', 'FILE_TOO_LARGE', 'FILE_EMPTY', 'PERMISSION_DENIED', 'FILE_TYPE_MISMATCH', 'FILE_CORRUPT'] as const;

/** H01 / S01 / D01 application forms with manual address entry (no map dependency). */
export function ApplyScreen(props: { kind: Kind }) {
  const { api, refreshMe, nav, pickFile } = usePartner();
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
  const [docs, setDocs] = useState<Partial<Record<DocType, DocState>>>({});
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

  /** Pick → register the document slot → upload the bytes privately. Each step is explained if it fails. */
  const addDocument = async (type: DocType, source: FileSource) => {
    if (!submitted) return;
    const set = (v: DocState) => setDocs((d) => ({ ...d, [type]: v }));
    const errorText = (code: string | undefined) =>
      code && (KNOWN_ERRORS as readonly string[]).includes(code) ? t(`partner.evidence.err.${code as (typeof KNOWN_ERRORS)[number]}` as const) : t('common.error.generic');
    let file;
    try {
      file = await pickFile(source);
    } catch (e) {
      return set({ state: 'failed', error: errorText((e as { code?: string }).code) });
    }
    if (!file) return; // cancelled: keep whatever was there
    set({ state: 'uploading' });
    try {
      const reg = await api.registerEvidence(submitted.id, { evidenceType: type, contentType: file.contentType, byteSize: file.bytes.length }, newIdempotencyKey());
      if (reg.upload.status !== 'PENDING_UPLOAD' || !reg.upload.uploadPath) return set({ state: 'referenceOnly' });
      await api.uploadEvidenceFile(reg.upload.uploadPath, file.bytes, file.contentType);
      set({ state: 'uploaded' });
    } catch (e) {
      set({ state: 'failed', error: errorText(e instanceof ApiError ? e.code : undefined) });
    }
  };

  const roleLabel = t(`partner.role.${props.kind}` as const);
  if (submitted) {
    return (
      <Screen testID="apply-done">
        <Text variant="display" role="header">{t('partner.applyAs', { role: roleLabel })}</Text>
        <Notice testID="application-submitted">{t('partner.applicationSubmitted')}</Notice>
        <Text variant="title" role="header">{t('partner.evidence')}</Text>
        <Text muted>{t('partner.evidenceIntro')}</Text>
        {Object.values(docs).some((d) => d?.state === 'referenceOnly') ? <Notice tone="warning" testID="evidence-storage-off">{t('partner.evidenceDisabled')}</Notice> : null}
        {DOCS[props.kind].map((type) => {
          const d = docs[type];
          const badge = !d ? { status: 'pending' as const, label: t('partner.evidence.notAdded') }
            : d.state === 'uploading' ? { status: 'progress' as const, label: t('partner.evidence.uploading') }
            : d.state === 'uploaded' ? { status: 'confirmed' as const, label: t('partner.evidence.uploaded') }
            : d.state === 'referenceOnly' ? { status: 'pending' as const, label: t('partner.evidence.referenceOnly') }
            : { status: 'failed' as const, label: t('partner.evidence.failed') };
          const busyDoc = d?.state === 'uploading';
          return (
            <Card key={type} testID={`doc-${type}`}>
              <Row>
                <Text variant="label" style={{ flex: 1 }}>{t(`evidenceType.${type}` as const)}</Text>
                <StatusBadge status={badge.status} label={badge.label} testID={`doc-${type}-status`} />
              </Row>
              {d?.error ? <Text tone="danger" variant="caption" testID={`doc-${type}-error`}>⚠ {d.error}</Text> : null}
              <Row wrap>
                <Button variant="secondary" label={t('partner.evidence.takePhoto')} disabled={busyDoc} onPress={() => addDocument(type, 'camera')} testID={`doc-${type}-camera`} />
                <Button variant="tertiary" label={t('partner.evidence.choosePhoto')} disabled={busyDoc} onPress={() => addDocument(type, 'photo')} testID={`doc-${type}-photo`} />
                <Button variant="tertiary" label={t('partner.evidence.chooseFile')} disabled={busyDoc} onPress={() => addDocument(type, 'document')} testID={`doc-${type}-file`} />
              </Row>
            </Card>
          );
        })}
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

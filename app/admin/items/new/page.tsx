'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminNav } from '../../_components/admin-nav';
import { Footer } from '@/app/_components/footer';
import { Field } from '@/app/_components/field';
import { Input, Textarea } from '@/app/_components/input';
import { Select } from '@/app/_components/select';
import { Button } from '@/app/_components/button';
import { ErrorBanner } from '@/app/_components/error-banner';
import {
  CONDITION_ENUM,
  type Condition,
} from '@/app/_components/condition-enum';
import { createItem, ApiError } from '@/lib/admin-api';

export default function NewItemPage() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [coreFunctionality, setCoreFunctionality] = React.useState('');
  const [otherFunctionality, setOtherFunctionality] = React.useState('');
  const [quantity, setQuantity] = React.useState('1');
  const [condition, setCondition] = React.useState<string>('Working');
  const [saving, setSaving] = React.useState(false);
  const [errorCode, setErrorCode] = React.useState<string | null>(null);
  const [conditionError, setConditionError] = React.useState<string | null>(
    null,
  );
  const bannerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (errorCode && bannerRef.current) {
      const heading = bannerRef.current.querySelector(
        'h3, [role="alert"] h3, h2, h1',
      );
      if (heading instanceof HTMLElement) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      }
    }
  }, [errorCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setErrorCode(null);
    setConditionError(null);

    try {
      const parsedQty = parseInt(quantity, 10);
      await createItem({
        name,
        core_functionality: coreFunctionality,
        other_functionality: otherFunctionality || null,
        condition: condition as Condition,
        quantity: isNaN(parsedQty) ? 1 : Math.max(0, parsedQty),
      });
      router.push('/admin');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorCode(err.code);
        if (err.code === 'condition-enum-invalid' || err.status === 409) {
          setConditionError('Choose one of the four recorded states.');
        }
      } else {
        setErrorCode('save-failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const isConditionInEnum = CONDITION_ENUM.includes(condition as Condition);

  return (
    <>
      <AdminNav current="/admin" />

      <main
        id="main"
        className="flex-1 max-w-[var(--layout-containerMax)] mx-auto w-full px-[var(--layout-gutter)] py-8 md:py-10"
      >
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            href="/admin"
            className="text-fg-link hover:underline min-h-11 inline-flex items-center px-1"
          >
            The inventory
          </Link>
          <span className="text-fg-muted mx-2" aria-hidden="true">
            /
          </span>
          <span className="text-fg-muted">New item</span>
        </nav>

        <div className="flex flex-col gap-2 max-w-[var(--layout-measure)] mb-6">
          <h1 className="text-h1 tracking-h1 font-sans font-bold text-neutral-900 m-0">
            Add an item
          </h1>
          <p className="text-body text-fg-muted m-0">
            Record the item as the lab team described it. Nothing is rewritten.
          </p>
        </div>

        {errorCode ? (
          <div
            ref={bannerRef}
            className="banner-slot mb-6 max-w-[var(--layout-measure)]"
          >
            <ErrorBanner code={errorCode} />
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          aria-busy={saving ? 'true' : undefined}
          data-state={saving ? 'saving' : undefined}
          className="form__block apple-card max-w-[var(--layout-measure)] bg-bg-surface border border-border-rule rounded-md p-5 flex flex-col gap-6"
        >
          <Field
            label="ITEM NAME"
            required
            help="The name as the lab team wrote it. Spaces at the ends are kept."
            disabled={saving}
          >
            {({ id, describedBy, invalid, disabled }) => (
              <Input
                id={id}
                type="text"
                name="name"
                required
                value={name}
                disabled={disabled}
                readOnly={saving}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>

          <Field
            label="CORE FUNCTIONALITY (AS SUBMITTED)"
            required
            help="Exactly the words the lab team submitted, including their own spelling and spacing."
            disabled={saving}
          >
            {({ id, describedBy, invalid, disabled }) => (
              <Textarea
                id={id}
                name="core_functionality"
                required
                value={coreFunctionality}
                disabled={disabled}
                readOnly={saving}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(e) => setCoreFunctionality(e.target.value)}
              />
            )}
          </Field>

          <Field
            label="OTHER FUNCTIONALITY (AS SUBMITTED)"
            help="Leave empty if the lab team gave nothing else."
            disabled={saving}
          >
            {({ id, describedBy, invalid, disabled }) => (
              <Textarea
                id={id}
                name="other_functionality"
                value={otherFunctionality}
                disabled={disabled}
                readOnly={saving}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(e) => setOtherFunctionality(e.target.value)}
              />
            )}
          </Field>

          <Field
            label="QUANTITY"
            required
            help="Whole numbers only. 0 or more."
            disabled={saving}
          >
            {({ id, describedBy, invalid, disabled }) => (
              <Input
                id={id}
                type="number"
                min="0"
                variant="number"
                name="quantity"
                required
                value={quantity}
                disabled={disabled}
                readOnly={saving}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(e) => setQuantity(e.target.value)}
              />
            )}
          </Field>

          <Field
            label="CONDITION"
            required
            help="Exactly one of: Working, Faulty, Under Maintenance, Decommissioned."
            error={conditionError || undefined}
            disabled={saving}
          >
            {({ id, describedBy, invalid, disabled }) => (
              <Select
                id={id}
                name="condition"
                value={condition}
                disabled={disabled}
                aria-describedby={describedBy}
                aria-invalid={invalid || Boolean(conditionError) || undefined}
                onChange={(e) => setCondition(e.target.value)}
              >
                {!isConditionInEnum ? (
                  <option key={condition} value={condition}>
                    {condition}
                  </option>
                ) : null}
                {CONDITION_ENUM.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-medium text-fg-default">
                PHOTOGRAPHS
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="ghost" disabled={saving}>
                Choose a photograph
              </Button>
              <p className="text-caption text-fg-muted m-0">
                JPEG, PNG, WebP or AVIF. Photographs must be 8 MB or smaller.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border-rule">
            <Button
              type="submit"
              variant="default"
              disabled={saving}
              pendingLabel={saving ? 'Saving…' : undefined}
            >
              Save item
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => router.push('/admin')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </main>

      <Footer variant="admin" />
    </>
  );
}

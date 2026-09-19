import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";
import { canEditPlatformSettings } from "@/modules/authorization/policies";
import {
  FEATURE_MODES,
  SETTING_FIELDS,
  formatSettingOption,
  isFeatureKey,
  isPlatformSettingKey,
  settingMessageKey,
} from "@/modules/platform/settings";
import { updateFeatureFlag, updatePlatformSetting } from "@/server/actions/admin";
import { getSession, requireCapability } from "@/server/actor";
import { listFeatureFlags, listPlatformSettings } from "@/server/queries/admin";

/**
 * Platform settings and feature switches, described in the interface language
 * and edited by choosing among options (decision R6). Readable by all staff,
 * editable from Administrator rank.
 */
export default async function AdminSettingsPage({ params }: PageProps<"/[locale]/admin/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCapability(locale, "admin.platform_settings", `/${locale}/admin/settings`);
  const [t, session, settings, flags] = await Promise.all([
    getTranslations("admin.settings"),
    getSession(),
    listPlatformSettings(),
    listFeatureFlags(),
  ]);
  const editable = canEditPlatformSettings(session.actor).allowed;
  const saveSetting = updatePlatformSetting.bind(null, locale);
  const saveFlag = updateFeatureFlag.bind(null, locale);
  const card =
    "flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]";

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-bold">{t("title")}</h2>
        <p className="text-sm text-ink-muted">{t("lede")}</p>
      </div>
      {!editable ? <Alert>{t("readOnly")}</Alert> : null}

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-ink-muted">{t("settingsTitle")}</h3>
        <ul className="flex flex-col gap-3">
          {settings.map((setting) => {
            const known = isPlatformSettingKey(setting.key);
            const field = isPlatformSettingKey(setting.key) ? SETTING_FIELDS[setting.key] : null;
            const current: unknown = JSON.parse(setting.value);
            const messageKey = isPlatformSettingKey(setting.key) ? settingMessageKey(setting.key) : setting.key;
            return (
              <li key={setting.key} className={card}>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold">{known ? t(`fields.${messageKey}.label`) : setting.key}</p>
                  <p className="text-xs text-ink-muted">
                    {known ? t(`fields.${messageKey}.description`) : (setting.description ?? "")}
                  </p>
                </div>
                {editable && field ? (
                  <ActionForm
                    action={saveSetting}
                    messages="admin"
                    hidden={{ key: setting.key }}
                    submitLabel={t("save")}
                  >
                    {field.kind === "choice" ? (
                      <select name="value" defaultValue={String(current)} className={`${inputClass} h-9 w-auto`}>
                        {field.options.map((option) => (
                          <option key={option} value={String(option)}>
                            {formatSettingOption(field, option)}
                          </option>
                        ))}
                      </select>
                    ) : field.kind === "boolean" ? (
                      <select
                        name="value"
                        defaultValue={String(current === true)}
                        className={`${inputClass} h-9 w-auto`}
                      >
                        <option value="true">{t(`fields.${messageKey}.on`)}</option>
                        <option value="false">{t(`fields.${messageKey}.off`)}</option>
                      </select>
                    ) : (
                      <input
                        name="value"
                        type="email"
                        defaultValue={typeof current === "string" ? current : ""}
                        placeholder={t("emailPlaceholder")}
                        className={`${inputClass} field-ltr h-9 w-full sm:w-80`}
                      />
                    )}
                  </ActionForm>
                ) : (
                  <p className="text-sm" dir="ltr">
                    {field?.kind === "boolean"
                      ? t(`fields.${messageKey}.${current === true ? "on" : "off"}`)
                      : String(current === "" ? "—" : current)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-ink-muted">{t("flagsTitle")}</h3>
        <ul className="flex flex-col gap-3">
          {flags.map((flag) => {
            const known = isFeatureKey(flag.key);
            const modes: readonly string[] = isFeatureKey(flag.key) ? FEATURE_MODES[flag.key] : [flag.mode];
            return (
              <li key={flag.key} className={card}>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold">{known ? t(`flags.${flag.key}.label`) : flag.key}</p>
                  {known ? <p className="text-xs text-ink-muted">{t(`flags.${flag.key}.description`)}</p> : null}
                </div>
                {editable && known ? (
                  <ActionForm action={saveFlag} messages="admin" hidden={{ key: flag.key }} submitLabel={t("save")}>
                    <select name="mode" defaultValue={flag.mode} className={`${inputClass} h-9 w-auto`}>
                      {modes.map((mode) => (
                        <option key={mode} value={mode}>
                          {t(`flags.${flag.key}.modes.${mode}`)}
                        </option>
                      ))}
                    </select>
                  </ActionForm>
                ) : (
                  <p className="text-sm text-ink-muted">
                    {known ? t(`flags.${flag.key}.modes.${flag.mode}`) : flag.mode}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

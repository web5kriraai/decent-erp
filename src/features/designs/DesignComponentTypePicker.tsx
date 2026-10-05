"use client";

type ComponentTypeOption = {
  id: number;
  code: string;
  name: string;
  active?: boolean;
};

type DesignComponentTypePickerProps = {
  options: ComponentTypeOption[];
  value: number[];
  onChange: (ids: number[]) => void;
  error?: string;
  id?: string;
};

export function DesignComponentTypePicker({
  options,
  value,
  onChange,
  error,
  id = "componentTypes",
}: DesignComponentTypePickerProps) {
  const activeOptions = options.filter((o) => o.active !== false);

  function toggle(componentId: number) {
    onChange(
      value.includes(componentId)
        ? value.filter((x) => x !== componentId)
        : [...value, componentId],
    );
  }

  return (
    <fieldset className="form-field" id={id}>
      <legend className="form-label">Product components</legend>
      <p className="m-0 mb-2 text-xs text-muted-foreground">
        Select parts of this design (e.g. Pallu, Blouse). Link each image to a
        component when uploading.
      </p>
      <div className="form-grid form-grid--checkboxes" role="group" aria-label="Product components">
        {activeOptions.map((opt) => {
          const checked = value.includes(opt.id);
          const inputId = `${id}-${opt.id}`;
          return (
            <label key={opt.id} htmlFor={inputId} className="form-checkbox-row">
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(opt.id)}
              />
              <span>{opt.name}</span>
            </label>
          );
        })}
      </div>
      {activeOptions.length === 0 ? (
        <p className="m-0 mt-1 text-xs text-muted-foreground">No component types in masters.</p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

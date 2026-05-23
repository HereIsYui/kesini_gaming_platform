import React, {
  CSSProperties,
  FormEvent,
  ReactNode,
  useEffect,
  useState,
} from "react";
import Banner from "@douyinfe/semi-ui-19/lib/es/banner";
import SemiButton from "@douyinfe/semi-ui-19/lib/es/button";
import SemiCard from "@douyinfe/semi-ui-19/lib/es/card";
import SemiCheckbox from "@douyinfe/semi-ui-19/lib/es/checkbox";
import SemiDescriptions from "@douyinfe/semi-ui-19/lib/es/descriptions";
import SemiEmpty from "@douyinfe/semi-ui-19/lib/es/empty";
import "@douyinfe/semi-foundation/lib/es/form/form.css";
import FormSlot from "@douyinfe/semi-ui-19/lib/es/form/slot";
import SemiInput from "@douyinfe/semi-ui-19/lib/es/input";
import SemiTextArea from "@douyinfe/semi-ui-19/lib/es/input/textarea";
import SemiInputNumber from "@douyinfe/semi-ui-19/lib/es/inputNumber";
import SemiLayout from "@douyinfe/semi-ui-19/lib/es/layout";
import SemiList from "@douyinfe/semi-ui-19/lib/es/list";
import SemiModal from "@douyinfe/semi-ui-19/lib/es/modal";
import Progress from "@douyinfe/semi-ui-19/lib/es/progress";
import SemiRadio from "@douyinfe/semi-ui-19/lib/es/radio";
import SemiSelect from "@douyinfe/semi-ui-19/lib/es/select";
import SideSheet from "@douyinfe/semi-ui-19/lib/es/sideSheet";
import SemiSpace from "@douyinfe/semi-ui-19/lib/es/space";
import Spin from "@douyinfe/semi-ui-19/lib/es/spin";
import SemiSwitch from "@douyinfe/semi-ui-19/lib/es/switch";
import SemiTable from "@douyinfe/semi-ui-19/lib/es/table";
import SemiTabs from "@douyinfe/semi-ui-19/lib/es/tabs";
import SemiTag from "@douyinfe/semi-ui-19/lib/es/tag";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import SemiTypography from "@douyinfe/semi-ui-19/lib/es/typography";
import type { ButtonProps as SemiButtonProps } from "@douyinfe/semi-ui-19/lib/es/button/Button";
import type { CardProps as SemiCardProps } from "@douyinfe/semi-ui-19/lib/es/card";
import type { TextAreaProps as SemiTextAreaProps } from "@douyinfe/semi-ui-19/lib/es/input/textarea";
import type { ColumnProps, TableProps as SemiTableProps } from "@douyinfe/semi-ui-19/lib/es/table/interface";

export { Progress, Spin, Toast };

export const Typography = {
  Text: SemiTypography.Text,
  Paragraph: SemiTypography.Paragraph,
  Numeral: SemiTypography.Numeral,
  Title({
    level,
    ...props
  }: Omit<React.ComponentProps<typeof SemiTypography.Title>, "heading"> & {
    level?: 1 | 2 | 3 | 4 | 5 | 6;
  }) {
    return <SemiTypography.Title {...props} heading={level} />;
  },
};

function LayoutRoot(props: React.ComponentProps<typeof SemiLayout>) {
  return <SemiLayout {...props} />;
}

function LayoutSider({
  width,
  style,
  ...props
}: React.ComponentProps<typeof SemiLayout.Sider> & { width?: number | string }) {
  return (
    <SemiLayout.Sider
      {...props}
      style={{ ...style, width, flexBasis: width }}
    />
  );
}

export const Layout = Object.assign(LayoutRoot, {
  Header: SemiLayout.Header,
  Content: SemiLayout.Content,
  Footer: SemiLayout.Footer,
  Sider: LayoutSider,
});

export type TableColumnsType<T extends Record<string, any>> = Array<
  Omit<ColumnProps<T>, "render"> & {
    render?: (value: any, row: T, index: number) => ReactNode;
  }
>;

type SelectOptionLike = {
  label: ReactNode;
  value?: string | number | boolean;
  disabled?: boolean;
  options?: SelectOptionLike[];
};

type ValueChangeEvent<T extends HTMLElement> = React.ChangeEvent<T> & {
  target: EventTarget & T & { value: string };
};

function toValueEvent<T extends HTMLElement>(value: string) {
  return ({
    target: { value },
    currentTarget: { value },
  } as unknown) as ValueChangeEvent<T>;
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function useBreakpoint() {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 1200 : window.innerWidth,
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return { lg: width >= 992 };
}

export const Grid = { useBreakpoint };

export function Button({
  danger,
  type,
  ...props
}: Omit<SemiButtonProps, "type"> & {
  danger?: boolean;
  type?: "primary" | "default";
}) {
  return (
    <SemiButton
      {...props}
      theme={type === "primary" || danger ? "solid" : props.theme}
      type={danger ? "danger" : type === "primary" ? "primary" : "tertiary"}
    />
  );
}

export function Card({
  extra,
  size,
  ...props
}: SemiCardProps & {
  extra?: ReactNode;
  size?: "small";
}) {
  return <SemiCard {...props} headerExtraContent={extra} />;
}

function FormRoot({
  children,
  className,
  layout = "vertical",
  onFinish,
  onSubmit,
  style,
  ...props
}: Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  layout?: "horizontal" | "vertical";
  onFinish?: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      {...props}
      className={cx("semi-form", `semi-form-${layout}`, className)}
      style={style}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(event);
        onFinish?.();
      }}
    >
      {children}
    </form>
  );
}

function FormItem({
  className,
  label,
  extra,
  children,
}: {
  className?: string;
  label?: ReactNode;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <FormSlot className={className} label={label}>
      {children}
      {extra ? (
        <Typography.Text className="form-extra" size="small" type="tertiary">
          {extra}
        </Typography.Text>
      ) : null}
    </FormSlot>
  );
}

export const Form = Object.assign(FormRoot, { Item: FormItem });

type InputProps = Omit<
  React.ComponentProps<typeof SemiInput>,
  "onChange" | "showClear"
> & {
  allowClear?: boolean;
  onChange?: (event: ValueChangeEvent<HTMLInputElement>) => void;
};

function InputRoot({ allowClear, onChange, ...props }: InputProps) {
  return (
    <SemiInput
      {...props}
      showClear={allowClear}
      onChange={(value) => onChange?.(toValueEvent<HTMLInputElement>(value))}
    />
  );
}

function TextArea({
  allowClear,
  autoSize,
  onChange,
  ...props
}: Omit<
  SemiTextAreaProps,
  "onChange" | "showClear" | "autosize"
> & {
  allowClear?: boolean;
  autoSize?: boolean | { minRows?: number; maxRows?: number };
  onChange?: (event: ValueChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <SemiTextArea
      {...props}
      autosize={autoSize}
      showClear={allowClear}
      onChange={(value: string) =>
        onChange?.(toValueEvent<HTMLTextAreaElement>(value))
      }
    />
  );
}

function Password(props: InputProps) {
  return <InputRoot {...props} mode="password" />;
}

export const Input = Object.assign(InputRoot, { TextArea, Password });

export function InputNumber({
  addonAfter,
  onChange,
  value,
  ...props
}: Omit<
  React.ComponentProps<typeof SemiInputNumber>,
  "onChange" | "suffix" | "value"
> & {
  addonAfter?: ReactNode;
  value?: number | string | null;
  onChange?: (value: number | null) => void;
}) {
  return (
    <SemiInputNumber
      {...props}
      value={value ?? undefined}
      suffix={addonAfter}
      onChange={(value) => {
        if (value === "" || value === null || value === undefined) {
          onChange?.(null);
          return;
        }
        onChange?.(Number(value));
      }}
    />
  );
}

export type SelectProps<ValueType = any> = Omit<
  React.ComponentProps<typeof SemiSelect>,
  "value" | "defaultValue" | "onChange" | "optionList" | "showClear"
> & {
  value?: ValueType;
  defaultValue?: ValueType;
  options?: SelectOptionLike[];
  allowClear?: boolean;
  popupMatchSelectWidth?: boolean;
  onChange?: (value: ValueType) => void;
};

function renderSelectOption(option: SelectOptionLike) {
  return (
    <SemiSelect.Option
      disabled={option.disabled}
      key={String(option.value ?? option.label)}
      value={String(option.value ?? "")}
    >
      {option.label}
    </SemiSelect.Option>
  );
}

export function Select<ValueType = any>({
  value,
  defaultValue,
  options = [],
  allowClear,
  popupMatchSelectWidth,
  children,
  onChange,
  ...props
}: SelectProps<ValueType>) {
  return (
    <SemiSelect
      {...props}
      value={value === undefined || value === null ? undefined : String(value)}
      defaultValue={
        defaultValue === undefined || defaultValue === null
          ? undefined
          : String(defaultValue)
      }
      showClear={allowClear}
      dropdownMatchSelectWidth={popupMatchSelectWidth}
      onChange={(nextValue) =>
        onChange?.(((nextValue ?? "") as unknown) as ValueType)
      }
    >
      {options.map((option) =>
        option.options ? (
          <SemiSelect.OptGroup
            key={String(option.label)}
            label={String(option.label)}
          >
            {option.options.map(renderSelectOption)}
          </SemiSelect.OptGroup>
        ) : (
          renderSelectOption(option)
        ),
      )}
      {children}
    </SemiSelect>
  );
}

export const Checkbox = SemiCheckbox;

export function Switch({
  checkedChildren,
  unCheckedChildren,
  onChange,
  ...props
}: React.ComponentProps<typeof SemiSwitch> & {
  checkedChildren?: ReactNode;
  unCheckedChildren?: ReactNode;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <SemiSwitch
      {...props}
      checkedText={checkedChildren}
      uncheckedText={unCheckedChildren}
      onChange={(checked) => onChange?.(checked)}
    />
  );
}

export function Segmented({
  value,
  options,
  onChange,
}: {
  value?: string | number;
  options: Array<{ label: ReactNode; value: string | number; disabled?: boolean }>;
  onChange?: (value: string | number) => void;
}) {
  const RadioGroup = SemiRadio.Group;

  return (
    <RadioGroup
      buttonSize="middle"
      mode="advanced"
      options={options}
      type="button"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}

export function Space({
  direction,
  size,
  align,
  ...props
}: Omit<React.ComponentProps<typeof SemiSpace>, "spacing" | "vertical" | "align"> & {
  direction?: "horizontal" | "vertical";
  size?: number | "loose" | "medium" | "tight";
  align?: CSSProperties["alignItems"];
}) {
  const semiAlign =
    align === "center" ||
    align === "start" ||
    align === "end" ||
    align === "baseline"
      ? align
      : undefined;
  return (
    <SemiSpace
      {...props}
      align={semiAlign as React.ComponentProps<typeof SemiSpace>["align"]}
      spacing={size}
      vertical={direction === "vertical"}
    />
  );
}

export type MenuProps = {
  items?: MenuItem[];
};

type MenuItem = {
  key: string;
  label?: ReactNode;
  title?: string;
  icon?: ReactNode;
  type?: "group";
  children?: MenuItem[];
};

export function Menu({
  className,
  items = [],
  selectedKeys = [],
  onClick,
}: {
  className?: string;
  mode?: "inline";
  items?: MenuItem[];
  selectedKeys?: string[];
  onClick?: (event: { key: string }) => void;
}) {
  return (
    <nav className={cx("nav-list", className)}>
      {items.map((item) => (
        <section className="nav-section" key={item.key}>
          {item.label ? (
            <div className="nav-section-title">{item.label}</div>
          ) : null}
          <div className="nav-section-items">
            {item.children?.map((child) => (
              <button
                className={cx(selectedKeys.includes(child.key) && "active")}
                key={child.key}
                title={child.title}
                type="button"
                onClick={() => onClick?.({ key: child.key })}
              >
                {child.icon}
                <span className="nav-item-label">{child.label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}

export function Drawer({
  open,
  onClose,
  placement,
  ...props
}: Omit<React.ComponentProps<typeof SideSheet>, "visible" | "onCancel"> & {
  open?: boolean;
  onClose?: () => void;
  placement?: "left" | "right" | "top" | "bottom";
}) {
  return (
    <SideSheet
      {...props}
      placement={placement}
      visible={open}
      onCancel={() => onClose?.()}
    />
  );
}

type ModalCompatProps = Omit<
  React.ComponentProps<typeof SemiModal>,
  "visible" | "onCancel" | "onOk" | "keepDOM"
> & {
  open?: boolean;
  onCancel?: () => void;
  onOk?: () => void | Promise<void>;
  destroyOnHidden?: boolean;
  okButtonProps?: { danger?: boolean };
};

function ModalRoot({
  open,
  onCancel,
  onOk,
  destroyOnHidden,
  okButtonProps,
  ...props
}: ModalCompatProps) {
  return (
    <SemiModal
      {...props}
      keepDOM={!destroyOnHidden}
      okType={okButtonProps?.danger ? "danger" : props.okType}
      visible={open}
      onCancel={() => onCancel?.()}
      onOk={() => onOk?.()}
    />
  );
}

export const Modal = Object.assign(ModalRoot, {
  confirm(options: {
    title?: ReactNode;
    content?: ReactNode;
    okText?: ReactNode;
    cancelText?: ReactNode;
    okButtonProps?: { danger?: boolean };
    onOk?: () => void | Promise<void>;
  }) {
    return SemiModal.confirm({
      title: options.title,
      content: options.content,
      okText: String(options.okText || "确定"),
      cancelText: String(options.cancelText || "取消"),
      okType: options.okButtonProps?.danger ? "danger" : "primary",
      onOk: () => options.onOk?.(),
    });
  },
});

export function Table<T extends Record<string, any>>({
  pagination,
  locale,
  columns,
  rowKey,
  ...props
}: Omit<SemiTableProps<T>, "pagination" | "empty" | "columns" | "rowKey"> & {
  columns?: TableColumnsType<T>;
  rowKey?: keyof T | ((row: T) => string);
  pagination?: {
    current?: number;
    pageSize?: number;
    total?: number;
    showSizeChanger?: boolean;
    showTotal?: (total: number) => ReactNode;
    onChange?: (page: number) => void;
  };
  locale?: { emptyText?: ReactNode };
}) {
  return (
    <SemiTable<T>
      {...props}
      columns={columns as ColumnProps<T>[]}
      rowKey={rowKey as SemiTableProps<T>["rowKey"]}
      empty={locale?.emptyText}
      pagination={
        pagination
          ? {
              currentPage: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: pagination.showSizeChanger,
              showTotal: Boolean(pagination.showTotal),
              onPageChange: (page) => pagination.onChange?.(page),
            }
          : false
      }
    />
  );
}

export function Tabs({
  items,
  ...props
}: Omit<React.ComponentProps<typeof SemiTabs>, "tabList"> & {
  items?: Array<{ key: string; label: ReactNode }>;
}) {
  return (
    <SemiTabs
      {...props}
      tabList={items?.map((item) => ({
        itemKey: item.key,
        tab: item.label,
      }))}
    />
  );
}

export function Tag({
  color,
  ...props
}: Omit<React.ComponentProps<typeof SemiTag>, "color"> & {
  color?: string;
}) {
  const mappedColor =
    color === "success"
      ? "green"
      : color === "error" || color === "danger"
        ? "red"
        : color === "default"
          ? "grey"
          : color === "geekblue"
            ? "blue"
            : color;
  return <SemiTag {...props} color={mappedColor as any} />;
}

export function Alert({
  type = "info",
  message,
  description,
  children,
  showIcon,
  ...props
}: Omit<React.ComponentProps<typeof Banner>, "type" | "description"> & {
  type?: "success" | "error" | "warning" | "info";
  message?: ReactNode;
  description?: ReactNode;
  showIcon?: boolean;
}) {
  return (
    <Banner
      {...props}
      description={message || description || children}
      type={type === "error" ? "danger" : type}
    />
  );
}

export function Empty({
  description,
  ...props
}: React.ComponentProps<typeof SemiEmpty> & { description?: ReactNode }) {
  return <SemiEmpty {...props} description={description} />;
}

export function Statistic({
  title,
  value,
  prefix,
}: {
  title?: ReactNode;
  value?: ReactNode;
  prefix?: ReactNode;
}) {
  return (
    <div className="admin-statistic">
      <Typography.Text type="tertiary">{title}</Typography.Text>
      <div className="admin-statistic-value">
        {prefix}
        <strong>{value}</strong>
      </div>
    </div>
  );
}

type ListItemProps = React.ComponentProps<typeof SemiList.Item>;

function ListItemMeta({
  avatar,
  title,
  description,
}: {
  avatar?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="admin-list-meta">
      {avatar}
      <div>
        <div>{title}</div>
        <Typography.Text type="tertiary">{description}</Typography.Text>
      </div>
    </div>
  );
}

const ListItem = Object.assign((props: ListItemProps) => <SemiList.Item {...props} />, {
  Meta: ListItemMeta,
});

export const List = Object.assign(SemiList, { Item: ListItem });

export function Descriptions({
  items = [],
  bordered,
  ...props
}: Omit<React.ComponentProps<typeof SemiDescriptions>, "data"> & {
  bordered?: boolean;
  items?: Array<{ key?: string; label: ReactNode; children: ReactNode }>;
}) {
  return (
    <SemiDescriptions
      {...props}
      data={items.map((item) => ({
        key: item.label,
        value: item.children,
      }))}
    />
  );
}

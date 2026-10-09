declare module "drizzle-orm/sqlite-core" {
  interface ColumnBuilder {
    primaryKey(): ColumnBuilder;
    notNull(): ColumnBuilder;
    default(value: unknown): ColumnBuilder;
  }

  interface IndexBuilder {
    on(...columns: ColumnBuilder[]): unknown;
  }

  type ColumnMap = Record<string, ColumnBuilder>;

  export function text(name: string): ColumnBuilder;
  export function integer(name: string, options?: { mode?: string }): ColumnBuilder;
  export function real(name: string): ColumnBuilder;
  export function index(name: string): IndexBuilder;
  export function uniqueIndex(name: string): IndexBuilder;
  export function sqliteTable<TColumns extends ColumnMap>(
    name: string,
    columns: TColumns,
    indexes?: (table: TColumns) => Record<string, unknown>
  ): TColumns;
}

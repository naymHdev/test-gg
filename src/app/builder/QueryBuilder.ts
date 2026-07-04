/* eslint-disable @typescript-eslint/no-explicit-any */

type TQueryOptions = {
  where: Record<string, any>;
  orderBy?: Record<string, "asc" | "desc">[] | Record<string, "asc" | "desc">;
  skip?: number;
  take?: number;
  select?: Record<string, boolean>;
  include?: Record<string, any>;
};

class QueryBuilder<T> {
  public options: TQueryOptions = { where: {} };
  public query: Record<string, unknown>;

  constructor(query: Record<string, unknown>) {
    this.query = query;
    for (const key in this.query) {
      if (
        Object.prototype.hasOwnProperty.call(this.query, key) &&
        key !== "searchTerm" &&
        (this.query[key] === undefined ||
          this.query[key] === null ||
          this.query[key] === "")
      ) {
        delete this.query[key];
      }
    }
  }

  search(searchableFields: string[]) {
    const searchTerm = this?.query?.searchTerm as string | undefined;
    if (searchTerm) {
      this.options.where = {
        ...this.options.where,
        OR: searchableFields.map((field) => ({
          [field]: { contains: searchTerm, mode: "insensitive" },
        })),
      };
    }
    return this;
  }

  filter() {
    const queryObj = { ...this.query };
    const excludeFields = ["searchTerm", "sort", "limit", "page", "fields"];
    excludeFields.forEach((el) => delete queryObj[el]);

    this.options.where = { ...this.options.where, ...queryObj };
    return this;
  }

  // Operators: field=>=10, field=>5, field=<=20, field=<8, field=!=3,
  // field=val1||val2, field=[val]
  conditionalFilter() {
    const queryObj = { ...this.query };
    const excludeFields = ["searchTerm", "sort", "limit", "page", "fields"];
    excludeFields.forEach((el) => delete queryObj[el]);

    for (const key in queryObj) {
      const value = queryObj[key];
      if (typeof value !== "string") continue;

      if (value.includes(">=")) {
        const [, amount] = value.split(">=");
        this.options.where[key] = { gte: Number(amount) };
      } else if (value.includes(">")) {
        const [, amount] = value.split(">");
        this.options.where[key] = { gt: Number(amount) };
      } else if (value.includes("<=")) {
        const [, amount] = value.split("<=");
        this.options.where[key] = { lte: Number(amount) };
      } else if (value.includes("<")) {
        const [, amount] = value.split("<");
        this.options.where[key] = { lt: Number(amount) };
      } else if (value.includes("!=")) {
        const [, amount] = value.split("!=");
        this.options.where[key] = { not: Number(amount) };
      } else if (value.includes("!")) {
        const [, v] = value.split("!");
        this.options.where[key] = { not: v };
      } else if (value.includes("-")) {
        const [min, max] = value.split("-").map(Number);
        if (!isNaN(min) && !isNaN(max)) {
          this.options.where[key] = { gte: min, lte: max };
        }
      } else if (value.includes("||")) {
        this.options.where[key] = { in: value.split("||") };
      } else if (/^\[.*?\]$/.test(value)) {
        const match = value.match(/\[(.*?)\]/);
        const queryValue = match ? match[1] : value;
        this.options.where[key] = { in: [queryValue] };
      } else {
        this.options.where[key] = value;
      }
    }

    return this;
  }

  sort() {
    const sortQuery = this?.query?.sort as string | undefined;
    if (!sortQuery) {
      this.options.orderBy = { createdAt: "desc" };
      return this;
    }

    const orderBy = sortQuery.split(",").map((field) => {
      if (field.startsWith("-")) {
        return { [field.slice(1)]: "desc" as const };
      }
      return { [field]: "asc" as const };
    });

    this.options.orderBy = orderBy.length === 1 ? orderBy[0] : orderBy;
    return this;
  }

  paginate() {
    const page = Number(this?.query?.page) || 1;
    const limit = Number(this?.query?.limit) || 10;
    const skip = (page - 1) * limit;

    this.options.skip = skip;
    this.options.take = limit;
    return this;
  }

  fields() {
    const fieldsQuery = this?.query?.fields as string | undefined;
    if (fieldsQuery) {
      const select: Record<string, boolean> = {};
      fieldsQuery.split(",").forEach((f) => {
        select[f.trim()] = true;
      });
      this.options.select = select;
    }
    return this;
  }

  include(relations: Record<string, any>) {
    this.options.include = { ...this.options.include, ...relations };
    return this;
  }

  build(): TQueryOptions {
    return this.options;
  }

  async countTotal(model: {
    count: (args: { where: any }) => Promise<number>;
  }) {
    const total = await model.count({ where: this.options.where });
    const page = Number(this?.query?.page) || 1;
    const limit = Number(this?.query?.limit) || 10;
    const totalPage = Math.ceil(total / limit);

    return { page, limit, total, totalPage };
  }
}

export default QueryBuilder;

/*__________________________________________________  
_________________________ Use Case _________________________
___________________________________________________________________
const queryBuilder = new QueryBuilder<Product>(req.query)
  .search(["name", "description"])
  .filter()
  .sort()
  .paginate()
  .fields();

const options = queryBuilder.build();

const products = await prisma.product.findMany(options);
const meta = await queryBuilder.countTotal(prisma.product);

*/

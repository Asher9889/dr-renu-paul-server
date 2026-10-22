## Module Architecture (source of truth: `src/modules/user/`)

Every module is a self-contained folder with the same files. Use `src/modules/user/` as the
reference example.

```
src/modules/<name>/
├── <name>.constant.ts   enums + event names
├── <name>.schema.ts     Zod schemas (body / params / query)
├── <name>.types.ts      inferred types
├── <name>.model.ts      Mongoose model + interface + methods/hooks
├── <name>.service.ts    business logic (class)
├── <name>.controller.ts HTTP layer (class, DI of service)
├── <name>.module.ts     composition root (singletons)
├── <name>.routes.ts     Express router
└── index.ts             public barrel
```

### Responsibilities

| File | Contains | Must NOT contain |
|---|---|---|
| `*.constant.ts` | `as const` objects (never TS `enum`), event name maps | logic |
| `*.schema.ts` | Zod schemas for body, route params, query | DB access |
| `*.types.ts` | `typeof CONST[keyof typeof CONST]` unions + `z.infer<typeof schema>` types; re-export constants | logic |
| `*.model.ts` | `I<Name>` interface, `mongoose.Schema`, indexes, methods, pre-hooks, `mongoose.model` | HTTP, req/res |
| `*.service.ts` | business rules, DB queries, `ApiError` throws, DTO shaping | req/res, next() |
| `*.controller.ts` | read `req.validatedBody` / `validatedParams` / `validatedQuery` / `validatedUser`, call service, return `ApiResponse.success` | business logic, DB access |
| `*.module.ts` | `new Service()`, `new Controller(service)`, export singletons | logic |
| `*.routes.ts` | `express.Router()`, middleware chain per route | business logic |
| `index.ts` | re-export routes, model, constants, events, types | logic |

### Standard wiring

`routes.ts` imports the controller singleton from `module.ts`:

```ts
import { userController } from "./user.module.ts";
router.get("/", authenticate, authorize(SUPER_ADMIN), queryValidate(querySchema), userController.getAllUsers);
```

`module.ts` performs dependency injection:

```ts
const userService = new UserService();
const userController = new UserController(userService);
export { userController, userService };
```

`index.ts` is the only public entry point for other modules:

```ts
export type { TUserRole, IUser, TCreateUserPayload, TUpdateUserPayload };
export { UserModel, USER_ROLE, ACCOUNT_STATUS, USER_EVENTS, userRoutes };
```

Mount routers in `src/routes/v1/index.ts` by importing `<name>Routes` from the module barrel.

### Middleware chain (order matters)

`authenticate` → `authorize(...roles)` → `paramsValidate(objectIdParamSchema)` →
`queryValidate(...)` or `schemaValidate(...)` → controller method.

- `schemaValidate` validates `req.body` → sets `req.validatedBody`
- `queryValidate` validates `req.query` → sets `req.validatedQuery`
- `paramsValidate` validates `req.params` → sets `req.validatedParams`
- `authenticate` loads the user → sets `req.validatedUser`
- `authorize(...roles)` checks `req.validatedUser.role`

### Service conventions

- Class with arrow-function methods (auto-bound): `methodName = async (...) => {}`
- Throw `new ApiError(StatusCodes.X, "message")`; never send responses.
- Strip `_id` and `password`; expose `{ id: _id.toString(), ...rest }`.
- Pagination returns `{ items/users, pagination: { page, limit, total, totalPages } }`.
- Emit domain events via `eventBus.emit(<NAME>_EVENTS.X.Y, payload)`.

### Controller conventions

- Class receiving the service via constructor; arrow-function methods.
- Always `try/catch` and `next(error)`.
- Responses: `ApiResponse.success(res, StatusCodes.OK, "Message", data)`.

### Validation conventions

- Zod 4. Use `Object.values(CONST)` for enums so constants stay the single source of truth.
- Query numbers use `z.coerce.number()` with `.default(...)`.
- Mongo ids: `z.string().refine((v) => mongoose.Types.ObjectId.isValid(v))`.
- Write schemas in `*.schema.ts`, derive payload types in `*.types.ts`; never duplicate types.

## Adding a new module

1. Create the folder and the nine files listed above, copied in shape from `src/modules/user/`.
2. Define constants → schemas → types → model → service → controller → module → routes → index.
3. Mount the router in `src/routes/v1/index.ts`.
4. Do not import another module's internals directly; import from its `index.ts`.

## Commands

- Dev: `npm run dev`
- Build / typecheck: `npm run build`

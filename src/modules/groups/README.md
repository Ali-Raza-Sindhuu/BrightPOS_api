# Groups Module Documentation

## Overview
The Groups module manages user groups/roles in the POS system. It provides CRUD operations for creating, reading, updating, and deleting groups. Groups are used to organize users and will eventually be tied to permissions/roles.

## Architecture
The module follows the **MVC (Model-View-Controller)** pattern with an additional **Service layer**:

```
groupRoutes.js (Routes)
    ↓
groupController.js (Controllers)
    ↓
groupServices.js (Services - Business Logic)
    ↓
groupModel.js (Models - Database Operations)
    ↓
MySQL Database
```

## File Responsibilities

### 1. `groupRoutes.js` - Route Definitions
**Purpose:** Defines API endpoints and applies middleware for authentication and authorization.

**Endpoints:**
- `GET /` - List all groups (authenticated users)
- `GET /:id` - Get a specific group by ID (authenticated users)
- `POST /` - Create a new group (admin only)
- `PUT /:id` - Update an existing group (admin only)
- `PUT /:id/users` - Assign users to a group (admin only)
- `DELETE /:id` - Delete a group (admin only)

**Middleware:**
- `authenticate` - All routes require valid JWT token
- `requireAdmin` - Write operations (POST, PUT, DELETE) require admin role

**Note:** Write operations are currently admin-only. This will be replaced by the Day 2 rights engine (group_rights) for more granular permissions.

---

### 2. `groupController.js` - Request Handlers
**Purpose:** Handles HTTP requests/responses and delegates business logic to services.

**Functions:**
- `list(req, res)` - Returns all groups with member counts
- `getOne(req, res)` - Returns a single group by ID
- `create(req, res)` - Creates a new group (201 status)
- `update(req, res)` - Updates an existing group
- `setUsers(req, res)` - Assigns users to a group
- `remove(req, res)` - Deletes a group

**Response Format:**
```json
{
  "success": true,
  "data": { /* group object */ }
}
```

---

### 3. `groupServices.js` - Business Logic Layer
**Purpose:** Contains business rules, validations, and coordinates with the model layer.

**Functions:**

#### `listGroups()`
- Returns all groups ordered by name
- Includes member count for each group
- No parameters required

#### `getGroup(id)`
- Fetches a single group by ID
- Throws 404 error if group not found
- Parameter: `id` (number)

#### `createGroup({ name, description })`
- Validates that name is not empty
- Checks for duplicate group names
- Creates new group with `is_active = 1` by default
- Parameters:
  - `name` (string, required) - Group name
  - `description` (string, optional) - Group description

**Validation Rules:**
- Name cannot be empty or whitespace only
- Group name must be unique (case-sensitive)

#### `updateGroup(id, { name, description, isActive })`
- Validates that name is not empty
- Checks for duplicate names (excluding current group)
- Updates group fields
- Parameters:
  - `id` (number) - Group ID to update
  - `name` (string, required) - New group name
  - `description` (string, optional) - New description
  - `isActive` (boolean, optional) - Active status

**Validation Rules:**
- Name cannot be empty or whitespace only
- Group name must be unique (excluding current group)

#### `deleteGroup(id)`
- Validates that group exists
- Checks for existing members before deletion
- Throws 409 error if group has members
- Parameter: `id` (number)

**Validation Rules:**
- Group must exist (404 if not found)
- Group cannot have any assigned members (409 if members exist)

#### `setGroupUsers(groupId, userIds)`
- Assigns multiple users to a group
- Replaces all existing group memberships
- Validates that group exists
- Parameter:
  - `groupId` (number) - Group ID to assign users to
  - `userIds` (array) - Array of user IDs to assign

**Validation Rules:**
- `userIds` must be an array
- Group must exist (404 if not found)

**Behavior:**
- Removes all users currently assigned to the group
- Assigns only the users in the `userIds` array
- Empty array removes all users from the group

---

### 4. `groupModel.js` - Database Operations
**Purpose:** Direct database queries using MySQL connection pool.

**Functions:**

#### `findAll()`
- SQL: Selects all groups with member count
- Joins with `users` table to count members
- Orders by `name` ASC
- Returns array of group objects with `member_count` field

#### `findById(id)`
- SQL: Selects group by ID
- Returns single group object or `null`

#### `findByName(name, excludeId = null)`
- SQL: Selects group by name
- Optional: Excludes specific ID (for update duplicate check)
- Returns single group object or `null`

#### `create({ name, description })`
- SQL: Inserts new group with `is_active = 1`
- Returns the created group by calling `findById`

#### `update(id, { name, description, isActive })`
- SQL: Updates group fields
- Converts `isActive` boolean to 1/0
- Returns updated group by calling `findById`

#### `remove(id)`
- SQL: Deletes group by ID
- No return value

#### `countMembers(id)`
- SQL: Counts users in a group
- Returns member count as number

#### `assignUsersToGroup(groupId, userIds)`
- SQL: Updates user group assignments
- First removes all users from the group
- Then assigns selected users to the group
- Parameters:
  - `groupId` (number) - Group ID
  - `userIds` (array) - Array of user IDs to assign

**Behavior:**
- Sets `group_id = NULL` for all users currently in the group
- Sets `group_id = groupId` for users in the `userIds` array
- Handles empty arrays (removes all users)

---

## Database Schema

### `groups` Table
```sql
CREATE TABLE groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Relationships
- `groups.id` ← `users.group_id` (One-to-Many: One group can have many users)

---

## Data Flow Example

### Creating a Group
```
1. Client: POST /groups with { name: "Admin", description: "Administrators" }
2. groupRoutes.js: Validates JWT, checks admin role
3. groupController.js.create(): Calls service with request body
4. groupServices.js.createGroup(): Validates name, checks duplicates
5. groupModel.js.create(): Inserts into database
6. groupModel.js.findById(): Fetches created group
7. groupController.js: Returns 201 with group data
8. Client: Receives { success: true, data: { ... } }
```

---

## API Usage Examples

### List All Groups
```bash
GET /groups
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Admin",
      "description": "Administrators",
      "is_active": 1,
      "member_count": 5
    }
  ]
}
```

### Create Group
```bash
POST /groups
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Managers",
  "description": "Store managers"
}

Response (201):
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Managers",
    "description": "Store managers",
    "is_active": 1
  }
}
```

### Update Group
```bash
PUT /groups/2
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Store Managers",
  "description": "Updated description",
  "isActive": true
}

Response:
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Store Managers",
    "description": "Updated description",
    "is_active": 1
  }
}
```

### Delete Group
```bash
DELETE /groups/2
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "message": "Group deleted"
}
```

### Assign Users to Group
```bash
PUT /groups/2/users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "userIds": [1, 3, 5, 7]
}

Response:
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Managers",
    "description": "Store managers",
    "is_active": 1,
    "member_count": 4
  }
}
```

**Note:** This replaces all existing group members. To remove all users from a group, send an empty array:
```json
{
  "userIds": []
}
```

---

## Future Enhancements

1. ~~**Cascade Delete Check:** Prevent deletion of groups with existing members~~ ✅ **Implemented**
2. **Soft Delete:** Use `is_active` flag instead of hard delete
3. **Permissions Integration:** Connect with Day 2 rights engine
4. **Audit Trail:** Track who created/updated groups
5. **Bulk Operations:** Add endpoints for bulk create/update/delete
6. **Search/Filter:** Add search by name, filter by active status
7. **Pagination:** Add pagination for large group lists
8. **User Assignment History:** Track when users were added/removed from groups

---

## Error Handling

All errors are handled by `asyncHandler` middleware:

- **400 Bad Request:** Invalid input (empty name, etc.)
- **404 Not Found:** Group ID does not exist
- **409 Conflict:** Duplicate group name
- **401 Unauthorized:** Missing or invalid JWT
- **403 Forbidden:** Non-admin attempting write operations

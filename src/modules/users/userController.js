const asyncHandler = require("../../utils/asyncHandler");
const userService = require("./userServices");

const list = asyncHandler(async (req, res) => {
  const data = await userService.listUsers();
  res.json({ success: true, data });
});

const getOne = asyncHandler(async (req, res) => {
  const data = await userService.getUser(req.params.id);
  res.json({ success: true, data });
});

const create = asyncHandler(async (req, res) => {
  const { fullName, username, email, password, role, groupId } = req.body;
  const data = await userService.createUser({ fullName, username, email, password, role, groupId });
  res.status(201).json({ success: true, data });
});

const update = asyncHandler(async (req, res) => {
  const { fullName, username, email, role, groupId, isActive, password } = req.body;
  const data = await userService.updateUser(req.params.id, {
    fullName,
    username,
    email,
    role,
    groupId,
    isActive,
    password,
  });
  res.json({ success: true, data });
});

const remove = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id);
  res.json({ success: true, message: "User deleted" });
});

module.exports = { list, getOne, create, update, remove };

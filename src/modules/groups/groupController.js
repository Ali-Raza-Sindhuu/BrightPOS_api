const asyncHandler = require("../../utils/asyncHandler");
const groupService = require("./groupServices");

const list = asyncHandler(async (req, res) => {
  const groups = await groupService.listGroups();
  res.json({ success: true, data: groups });
});

const getOne = asyncHandler(async (req, res) => {
  const group = await groupService.getGroup(req.params.id);
  res.json({ success: true, data: group });
});

const create = asyncHandler(async (req, res) => {
  const group = await groupService.createGroup(req.body);
  res.status(201).json({ success: true, data: group });
});

const update = asyncHandler(async (req, res) => {
  const group = await groupService.updateGroup(req.params.id, req.body);
  res.json({ success: true, data: group });
});

const remove = asyncHandler(async (req, res) => {
  await groupService.deleteGroup(req.params.id);
  res.json({ success: true, message: "Group deleted" });
});

const getMembers = asyncHandler(async (req, res) => {
  const userIds = await groupService.getMemberIds(req.params.id);
  res.json({ success: true, data: userIds });
});

const setMembers = asyncHandler(async (req, res) => {
  const userIds = await groupService.setMembers(req.params.id, req.body.userIds);
  res.json({ success: true, data: userIds });
});

module.exports = { list, getOne, create, update, remove, getMembers, setMembers };

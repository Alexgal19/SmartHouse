/* global jest */
module.exports = {
  getIronSession: jest.fn().mockResolvedValue({
    save: jest.fn(),
    destroy: jest.fn(),
  }),
};

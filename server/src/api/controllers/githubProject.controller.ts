import type { NextFunction, Request, Response } from "express";
import { parse } from "../lib/utils";
import {
  projectIdParamSchema,
  githubPushSchema,
  githubCreateRepoSchema,
  githubPatchSchema,
  githubComparisonQuerySchema,
  githubDiffQuerySchema,
  githubListQuerySchema,
  githubRepositoryQuerySchema,
  githubNumberParamSchema,
  githubIssueCreateSchema,
} from "../schemas/project.schema";
import * as githubProjectService from "../services/githubProject.service";
import { requireUserId } from "../middleware/auth.middleware";

export const changes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { projectId } = parse(projectIdParamSchema, req.params);
    const query = parse(githubComparisonQuerySchema, req.query);
    res.status(200).json(await githubProjectService.changes(projectId, userId, query));
  } catch (err) { next(err); }
};

export const diff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { projectId } = parse(projectIdParamSchema, req.params);
    const { path, preview } = parse(githubDiffQuerySchema, req.query);
    res.status(200).json(await githubProjectService.diff(projectId, userId, path, preview));
  } catch (err) { next(err); }
};

/** GET /project/:projectId/github — panel state (repo, PRs, unpushed count). */
export const getInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(req);
    const { projectId } = parse(projectIdParamSchema, req.params);
    res.status(200).json(await githubProjectService.getInfo(projectId, userId));
  } catch (err) {
    next(err);
  }
};

/** POST /project/:projectId/github/push — one-click push (commit + PR/commit). */
export const push = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { projectId } = parse(projectIdParamSchema, req.params);
    const body = parse(githubPushSchema, req.body ?? {});
    res.status(200).json(await githubProjectService.push(projectId, userId, body));
  } catch (err) {
    next(err);
  }
};

/** POST /project/:projectId/github/repository � create a new private repository. */
export const createRepository = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { projectId } = parse(projectIdParamSchema, req.params);
    const body = parse(githubCreateRepoSchema, req.body);
    res.status(201).json(await githubProjectService.createRepository(projectId, userId, body));
  } catch (err) { next(err); }
};

/** DELETE /project/:projectId/github/link — detach the repo from the project. */
export const unlink = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(req);
    const { projectId } = parse(projectIdParamSchema, req.params);
    await githubProjectService.unlink(projectId, userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

/** PATCH /project/:projectId/github — change visibility and/or default push mode. */
export const patch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const { projectId } = parse(projectIdParamSchema, req.params);
    const changes = parse(githubPatchSchema, req.body);
    res
      .status(200)
      .json(await githubProjectService.patch(projectId, userId, changes));
  } catch (err) {
    next(err);
  }
};


export const pulls = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = parse(projectIdParamSchema, req.params);
    res.json(await githubProjectService.pulls(projectId, requireUserId(req), parse(githubListQuerySchema, req.query)));
  } catch (err) { next(err); }
};
export const pull = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, number } = parse(githubNumberParamSchema, req.params);
    const { repo } = parse(githubRepositoryQuerySchema, req.query);
    res.json(await githubProjectService.pull(projectId, requireUserId(req), repo, number));
  } catch (err) { next(err); }
};
export const issues = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = parse(projectIdParamSchema, req.params);
    res.json(await githubProjectService.issues(projectId, requireUserId(req), parse(githubListQuerySchema, req.query)));
  } catch (err) { next(err); }
};
export const issue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, number } = parse(githubNumberParamSchema, req.params);
    const { repo } = parse(githubRepositoryQuerySchema, req.query);
    res.json(await githubProjectService.issue(projectId, requireUserId(req), repo, number));
  } catch (err) { next(err); }
};
export const createIssue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = parse(projectIdParamSchema, req.params);
    res.status(201).json(await githubProjectService.createIssue(projectId, requireUserId(req), parse(githubIssueCreateSchema, req.body)));
  } catch (err) { next(err); }
};

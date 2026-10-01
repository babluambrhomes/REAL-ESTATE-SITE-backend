import { Response } from "express";
import { ApiResponse, asyncHandler, ApiError } from "../../utils";
import { AuthRequest } from "../../types";
import {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  ListMembersQueryInput,
  UpdateMemberInput,
  InviteMemberInput,
  AcceptInvitationInput,
} from "./organization.validation";
import * as organizationService from "./organization.service";

const requireUserId = (req: AuthRequest): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(401, "Not authenticated");
  }
  return userId;
};

/**
 * The organization id always comes from the route param, never from the body.
 *             
 * Taking it from the body would let a caller pass an :orgId they are allowed
 * to read alongside a body.organizationId belonging to a company they are not
 * a member of, and the wrong one would silently win.
 */ 
const requireOrgParam = (req: AuthRequest): string => String(req.params.orgId);

const createOrganization = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organization = await organizationService.createOrganization(
      requireUserId(req),
      req.body as CreateOrganizationInput
    );
    res.status(201).json(
      new ApiResponse(
        201,
        organization,
        "Organization created. You are its owner — complete company KYC before publishing listings."
      )
    );
  }
);

const listMyOrganizations = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizations = await organizationService.listMyOrganizations(
      requireUserId(req)
    );
    res.status(200).json(new ApiResponse(200, organizations));
  }
);

const getOrganization = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organization = await organizationService.getOrganization(
    requireOrgParam(req),
    requireUserId(req)
  );
  res.status(200).json(new ApiResponse(200, organization));
});

const updateOrganization = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organization = await organizationService.updateOrganization(
      requireOrgParam(req),
      req.body as UpdateOrganizationInput,
      requireUserId(req)
    );
    res.status(200).json(new ApiResponse(200, organization, "Organization updated"));
  }
);

const listMembers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const members = await organizationService.listMembers(
    requireOrgParam(req),
    (req as unknown as { validatedQuery: ListMembersQueryInput }).validatedQuery
  );
  res.status(200).json(new ApiResponse(200, members));
});

const updateMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const member = await organizationService.updateMember(
    requireOrgParam(req),
    String(req.params.memberId),
    requireUserId(req),
    req.body as UpdateMemberInput
  );
  res.status(200).json(new ApiResponse(200, member, "Member updated"));
});

const removeMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await organizationService.removeMember(
    requireOrgParam(req),
    String(req.params.memberId),
    requireUserId(req)
  );
  res.status(200).json(new ApiResponse(200, result, "Member removed"));
});

const listRoles = asyncHandler(async (req: AuthRequest, res: Response) => {
  const roles = await organizationService.listRoles(requireOrgParam(req));
  res.status(200).json(new ApiResponse(200, roles));
});

const inviteMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const invitation = await organizationService.inviteMember(
    requireOrgParam(req),
    requireUserId(req),
    req.body as InviteMemberInput
  );
  res.status(201).json(
    new ApiResponse(201, invitation, "Invitation created")
  );
});

const listInvitations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const invitations = await organizationService.listInvitations(
    requireOrgParam(req)
  );
  res.status(200).json(new ApiResponse(200, invitations));
});

const cancelInvitation = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const result = await organizationService.cancelInvitation(
      requireOrgParam(req),
      String(req.params.invitationId)
    );
    res.status(200).json(new ApiResponse(200, result, "Invitation cancelled"));
  }
);

const acceptInvitation = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { token } = req.body as AcceptInvitationInput;

    const result = await organizationService.acceptInvitation(
      token,
      requireUserId(req)
    );
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result,
          `You have joined ${result.organization?.name ?? "the organization"}`
        )
      );
  }
);

const listMyInvitations = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const invitations = await organizationService.listMyInvitations(
      requireUserId(req)
    );
    res.status(200).json(new ApiResponse(200, invitations));
  }
);

export {
  createOrganization,
  listMyOrganizations,
  getOrganization,
  updateOrganization,
  listMembers,
  updateMember,
  removeMember,
  listRoles,
  inviteMember,
  listInvitations,
  cancelInvitation,
  acceptInvitation,
  listMyInvitations,
};

import { addEvent, EventCode } from "@/lib/events";
import betagouv from "@betagouv";
import { PRInfo } from "@/lib/github";
import db from "@db";
import { PULL_REQUEST_TYPE, PULL_REQUEST_STATE } from "@/models/pullRequests";
import { requiredError, isValidDate } from "@controllers/validator";
import {
    makeGithubAuthorFile,
    updateMultipleFilesPR,
} from "@controllers/helpers/githubHelpers";
import {
    GithubAuthorChange,
    GithubBetagouvFile,
} from "@controllers/helpers/githubHelpers/githubEntryInterface";
import { GithubMission } from "@/models/mission";

export async function postBaseInfoUpdate(req, res) {
    const { username } = req.params;

    try {
        const formValidationErrors = {};
        const errorHandler = (field, message) => {
            const errorMessagesForKey = formValidationErrors[field] || [];
            // add new message to array
            errorMessagesForKey.push(message);
            // make it one message
            formValidationErrors[field] = errorMessagesForKey;
        };
        const role = req.body.role || requiredError("role", errorHandler);
        const startups =
            req.body.startups || requiredError("startups", errorHandler);
        const previously =
            req.body.previously || requiredError("previously", errorHandler);
        const { start, end } = req.body;
        const newEnd =
            req.body.end || requiredError("nouvelle date de fin", errorHandler);
        const startDate = new Date(start);
        const newEndDate = isValidDate(
            "nouvelle date de fin",
            new Date(end),
            errorHandler
        );
        if (startDate && newEndDate) {
            if (newEndDate < startDate) {
                errorHandler(
                    "nouvelle date de fin",
                    "La date doit être supérieure à la date de début"
                );
            }
        }

        if (Object.keys(formValidationErrors).length) {
            throw new Error("Erreur dans le formulaire", {
                cause: formValidationErrors,
            });
        }

        const info = await betagouv.userInfosById(username);
        const missions =
            info?.missions.map((mission) => ({
                ...mission,
                end: mission.end ? new Date(mission.end) : undefined,
                start: mission.start ? new Date(mission.start) : undefined,
            })) || [];
        if (missions.length) {
            missions[missions.length - 1].end = newEndDate;
        }
        const changes: GithubAuthorChange = {
            missions: missions as GithubMission[],
            role,
            startups,
            previously,
        };

        const files: GithubBetagouvFile[] = [
            makeGithubAuthorFile(username, changes),
        ];
        const prInfo: PRInfo = await updateMultipleFilesPR(
            `Maj de la fiche de ${username} par ${req.auth.id}`,
            files
        );

        addEvent(EventCode.MEMBER_BASE_INFO_UPDATED, {
            created_by_username: req.auth.id,
            action_on_username: username,
            action_metadata: {
                value: newEnd,
                old_value: end,
            },
        });
        await db("pull_requests").insert({
            url: prInfo.html_url,
            username,
            type: PULL_REQUEST_TYPE.PR_TYPE_MEMBER_UPDATE,
            status: PULL_REQUEST_STATE.PR_MEMBER_UPDATE_CREATED,
            info: JSON.stringify(changes),
        });
        const message = `⚠️ Pull request pour la mise à jour de la fiche de ${username} ouverte. 
        \nDemande à un membre de ton équipe de merger ta fiche : <a href="${prInfo.html_url}" target="_blank">${prInfo.html_url}</a>. 
        \nUne fois mergée, ton profil sera mis à jour.`;
        req.flash("message", message);
        res.json({
            message,
            username: username,
            pr_url: prInfo.html_url,
        });
    } catch (err) {
        let message;
        if (err instanceof Error) {
            message = {
                message: err.message,
                errors: err.cause,
            };
        }
        res.status(400).json(message);
    }
}